import { describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import {
  buildIntentPrompt,
  processEvent,
  routeTrackerEvent,
  startListener,
  stopListener,
  verifySignature,
  type ListenerConfig,
  type TrackerEvent,
} from '../listener.js';

const SECRET = 'test-secret';
const WHITELIST = ['pangpang778/factory-demo'];

function config(overrides: Partial<ListenerConfig> = {}): ListenerConfig {
  return { port: 0, secret: SECRET, whitelist: WHITELIST, cwd: process.cwd(), ...overrides };
}

function event(overrides: Partial<TrackerEvent> = {}): TrackerEvent {
  return {
    action: 'labeled',
    repository: { full_name: 'pangpang778/factory-demo' },
    label: { name: 'intake' },
    issue: { number: 7, title: '退款咨询', html_url: 'https://github.com/pangpang778/factory-demo/issues/7' },
    ...overrides,
  };
}

function signedBody(payload: unknown): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  return { body, signature: `sha256=${createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')}` };
}

describe('verifySignature', () => {
  it('accepts a correct sha256 signature', () => {
    const { body, signature } = signedBody(event());
    expect(verifySignature(SECRET, body, signature)).toBe(true);
  });

  it('rejects a wrong secret and a tampered body', () => {
    const { body, signature } = signedBody(event());
    expect(verifySignature('other', body, signature)).toBe(false);
    expect(verifySignature(SECRET, `${body} `, signature)).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    const { body } = signedBody(event());
    expect(verifySignature(SECRET, body, undefined)).toBe(false);
    expect(verifySignature(SECRET, body, 'md5=abc')).toBe(false);
  });
});

describe('routeTrackerEvent', () => {
  it('routes an intake-labeled event to the intent directive', () => {
    const r = routeTrackerEvent(event(), WHITELIST);
    expect(r).toEqual({
      kind: 'routed',
      directive: { stage: 'intent', skill: 'intent' },
      issueNumber: 7,
      issueUrl: 'https://github.com/pangpang778/factory-demo/issues/7',
    });
  });

  it('routes an opened issue that already carries the intake label', () => {
    const r = routeTrackerEvent(event({ action: 'opened', label: undefined, issue: { number: 1, labels: [{ name: 'intake' }] } }), WHITELIST);
    expect(r.kind).toBe('routed');
  });

  it('discards events without the intake label', () => {
    const r = routeTrackerEvent(event({ label: { name: 'bug' } }), WHITELIST);
    expect(r).toEqual({ kind: 'discarded', reason: 'no intake label (action: labeled)' });
  });

  it('discards when the route table has no intake directive', () => {
    const r = routeTrackerEvent(event(), WHITELIST, {});
    expect(r.kind).toBe('discarded');
  });
});

describe('processEvent', () => {
  it('spawns a headless intent session for a legal event', () => {
    const spawned: Array<[string, string[]]> = [];
    const audits: Record<string, unknown>[] = [];
    const result = processEvent(event(), config(), {
      spawner: (cmd, args) => spawned.push([cmd, args]),
      audit: (r) => audits.push(r),
    });
    expect(result.kind).toBe('accepted');
    expect(spawned).toEqual([['claude', ['-p', buildIntentPrompt({ stage: 'intent', skill: 'intent' }, 7, 'https://github.com/pangpang778/factory-demo/issues/7')]]]);
    expect(audits[0]).toMatchObject({ kind: 'routed', stage: 'intent', skill: 'intent', issue: 'https://github.com/pangpang778/factory-demo/issues/7' });
  });

  it('discards label-less events without spawning', () => {
    const spawned: Array<[string, string[]]> = [];
    const result = processEvent(event({ label: { name: 'question' } }), config(), { spawner: (cmd, args) => spawned.push([cmd, args]) });
    expect(result).toMatchObject({ status: 204, kind: 'discarded' });
    expect(spawned).toEqual([]);
  });

  it('rejects out-of-whitelist repos with an audit record', () => {
    const audits: Record<string, unknown>[] = [];
    const spawned: Array<[string, string[]]> = [];
    const result = processEvent(event({ repository: { full_name: 'someone/else' } }), config(), {
      spawner: (cmd, args) => spawned.push([cmd, args]),
      audit: (r) => audits.push(r),
    });
    expect(result).toMatchObject({ status: 403, kind: 'rejected' });
    expect(spawned).toEqual([]);
    expect(audits).toEqual([{ kind: 'rejected', status: 403, reason: 'repository outside whitelist: someone/else' }]);
  });
});

describe('listener server', () => {
  it('rejects bad HMAC with 401 and never routes', async () => {
    const spawned: Array<[string, string[]]> = [];
    const server = await startListener(config({ port: 0 }), { spawner: (cmd, args) => spawned.push([cmd, args]) });
    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('no port');
      const res = await fetch(`http://127.0.0.1:${addr.port}`, {
        method: 'POST',
        headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
        body: JSON.stringify(event()),
      });
      expect(res.status).toBe(401);
      expect(spawned).toEqual([]);
    } finally {
      stopListener(server, process.cwd());
    }
  });

  it('accepts a signed legal event end to end and exposes liveness on /status', async () => {
    const spawned: Array<[string, string[]]> = [];
    const server = await startListener(config({ port: 0 }), { spawner: (cmd, args) => spawned.push([cmd, args]) });
    try {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('no port');
      const base = `http://127.0.0.1:${addr.port}`;

      const status = await fetch(`${base}/status`);
      expect(status.status).toBe(200);
      expect(((await status.json()) as { ok: boolean }).ok).toBe(true);

      const { body, signature } = signedBody(event());
      const res = await fetch(base, { method: 'POST', headers: { 'x-hub-signature-256': signature }, body });
      expect(res.status).toBe(202);
      expect(spawned).toHaveLength(1);
      expect(spawned[0][0]).toBe('claude');
      expect(spawned[0][1][0]).toBe('-p');
    } finally {
      stopListener(server, process.cwd());
    }
  });
});
