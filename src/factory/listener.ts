/**
 * Factory listener daemon (spec: OMC 软件工厂闭环, tracker issue #9).
 *
 * Resident intake daemon: transport adapters (smee/cloudflared/direct) live
 * outside the OMC boundary — the daemon only receives already-unpacked
 * webhook events as POSTs. It verifies the HMAC signature, enforces the repo
 * whitelist, applies the intake label gate, and routes through the shared
 * routing pure function (T1 seam). v1 processes events serially.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { createServer, type Server, type ServerResponse, type IncomingMessage } from 'http';
import { spawn } from 'child_process';
import { appendFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { decideNextStage, type ChainDirective, type RouteTable } from '../hooks/session-end/routing.js';
import { getOmcRoot } from '../lib/worktree-paths.js';

export const INTAKE_LABEL = 'intake';
export const INTAKE_ROUTE_TABLE: RouteTable = { 'success:intake': { stage: 'intent', skill: 'intent' } };

/** GitHub issue webhook payload subset the daemon needs. */
export interface TrackerEvent {
  action?: string;
  repository?: { full_name?: string };
  label?: { name?: string };
  issue?: { number?: number; title?: string; html_url?: string; labels?: Array<{ name?: string }> };
}

export function verifySignature(secret: string, rawBody: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const provided = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(expected, 'utf8'));
}

export type RouteOutcome =
  | { kind: 'routed'; directive: ChainDirective; issueNumber?: number; issueUrl?: string }
  | { kind: 'discarded'; reason: string }
  | { kind: 'rejected'; status: number; reason: string };

/** Pure intake decision: whitelist -> label gate -> shared routing seam. */
export function routeTrackerEvent(
  event: TrackerEvent,
  whitelist: ReadonlyArray<string>,
  table: RouteTable = INTAKE_ROUTE_TABLE,
): RouteOutcome {
  const repo = event.repository?.full_name;
  if (!repo || !whitelist.includes(repo)) {
    return { kind: 'rejected', status: 403, reason: `repository outside whitelist: ${repo ?? '(missing)'}` };
  }
  const labels = new Set<string>();
  if (event.label?.name) labels.add(event.label.name);
  for (const l of event.issue?.labels ?? []) if (l.name) labels.add(l.name);
  const labeled = (event.action === 'labeled' || event.action === 'opened') && labels.has(INTAKE_LABEL);
  if (!labeled) return { kind: 'discarded', reason: `no ${INTAKE_LABEL} label (action: ${event.action ?? '?'})` };
  const directive = decideNextStage('success', 'intake', table);
  if (!directive) return { kind: 'discarded', reason: 'route table has no intake directive' };
  return { kind: 'routed', directive, issueNumber: event.issue?.number, issueUrl: event.issue?.html_url };
}

export function buildIntentPrompt(directive: ChainDirective, issueNumber?: number, issueUrl?: string): string {
  const target = issueUrl ?? `(issue #${issueNumber ?? '?'})`;
  return `/${directive.skill} 处理 tracker 进货：${target}。追问以 issue 评论回贴；回写契约：docs/intents/<slug>/ = 内容，issue 评论 = 记录指针，标签转 needs-review。`;
}

export interface ListenerConfig {
  port: number;
  secret: string;
  whitelist: ReadonlyArray<string>;
  cwd: string;
}

export interface ListenerDeps {
  spawner?: (cmd: string, args: string[]) => void;
  audit?: (record: Record<string, unknown>) => void;
}

export interface EventResult {
  status: number;
  kind: 'accepted' | 'discarded' | 'rejected';
  detail: string;
}

function defaultAudit(cwd: string): (record: Record<string, unknown>) => void {
  const dir = join(getOmcRoot(cwd), 'state');
  return (record) => {
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, 'factory-listener-audit.jsonl'), `${JSON.stringify({ ...record, at: new Date().toISOString() })}\n`, 'utf8');
    } catch {
      // best-effort audit trail
    }
  };
}

/** Orchestrates one event: audit rejections, discard noise, spawn routed sessions. */
export function processEvent(event: TrackerEvent, config: ListenerConfig, deps: ListenerDeps = {}): EventResult {
  const audit = deps.audit ?? defaultAudit(config.cwd);
  const outcome = routeTrackerEvent(event, config.whitelist);

  if (outcome.kind === 'rejected') {
    audit({ kind: 'rejected', status: outcome.status, reason: outcome.reason });
    return { status: outcome.status, kind: 'rejected', detail: outcome.reason };
  }
  if (outcome.kind === 'discarded') {
    return { status: 204, kind: 'discarded', detail: outcome.reason };
  }

  const prompt = buildIntentPrompt(outcome.directive, outcome.issueNumber, outcome.issueUrl);
  const args = ['-p', prompt];
  if (deps.spawner) deps.spawner('claude', args);
  else spawn('claude', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  audit({ kind: 'routed', stage: outcome.directive.stage, skill: outcome.directive.skill, issue: outcome.issueUrl ?? outcome.issueNumber });
  return { status: 202, kind: 'accepted', detail: `spawned ${outcome.directive.stage} session (${outcome.directive.skill})` };
}

function pidFilePath(cwd: string): string {
  return join(getOmcRoot(cwd), 'state', 'factory-listener.json');
}

export function startListener(config: ListenerConfig, deps: ListenerDeps = {}): Promise<Server> {
  const startedAt = new Date().toISOString();
  const server = createServer((req, res) => {
    void handleRequest(req, res, config, deps, startedAt);
  });
  return new Promise((resolve) => {
    server.listen(config.port, () => {
      mkdirSync(join(pidFilePath(config.cwd), '..'), { recursive: true });
      writeFileSync(pidFilePath(config.cwd), JSON.stringify({ pid: process.pid, port: config.port, startedAt }, null, 2));
      resolve(server);
    });
  });
}

export function stopListener(server: Server, cwd: string): void {
  try {
    unlinkSync(pidFilePath(cwd));
  } catch {
    // already gone
  }
  server.close();
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, config: ListenerConfig, deps: ListenerDeps, startedAt: string): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, pid: process.pid, port: config.port, startedAt }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  // Serial v1: every POST body drains before the next event spawns.
  const sig = req.headers['x-hub-signature-256'];
  if (!verifySignature(config.secret, raw, Array.isArray(sig) ? sig[0] : sig)) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid signature' }));
    return;
  }

  let event: TrackerEvent;
  try {
    event = JSON.parse(raw) as TrackerEvent;
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON' }));
    return;
  }

  const result = processEvent(event, config, deps);
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result));
}
