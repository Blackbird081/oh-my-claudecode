import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { decideNextStage, type ChainOutcome, type RouteTable } from './routing.js';
import { getOmcRoot } from '../../lib/worktree-paths.js';

export interface SpawnNextTracker {
  repo: string;
  issue: number;
  nextLabel: string;
  failedLabel: string;
}

/** How a finished session hands the chain to the next stage. Supplied by the enqueuer in the action payload under `chain`. */
export interface SpawnNextChain {
  outcome: ChainOutcome;
  reason: string;
  routeTable: RouteTable;
  sessionId: string;
  handoffContext?: string;
  tracker?: SpawnNextTracker;
}

export interface SpawnNextPlan {
  directive: { stage: string; skill: string };
  handoffPath: string;
  spawnArgv: string[];
  trackerCommands: string[];
}

export type SpawnFn = (command: string, args: string[]) => { unref(): void };

export function spawnNextAlertComment(chain: SpawnNextChain): string {
  return `链已停住：会话结束状态 ${chain.outcome}:${chain.reason} 触发下一环启动失败，需人工修复（v1 无自动重试）。`;
}

export function planSpawnNext(chain: SpawnNextChain, omcRoot: string): SpawnNextPlan | null {
  const directive = decideNextStage(chain.outcome, chain.reason, chain.routeTable);
  if (!directive) return null;
  const handoffPath = path.join(omcRoot, 'handoffs', `${chain.sessionId}-${directive.stage}.json`);
  const trackerCommands = chain.tracker
    ? [
        `gh issue edit ${chain.tracker.issue} --repo ${chain.tracker.repo} --add-label ${chain.tracker.nextLabel}`,
        `gh issue comment ${chain.tracker.issue} --repo ${chain.tracker.repo} --body "链已推进到 ${directive.stage}，交接上下文：${path.basename(handoffPath)}"`,
      ]
    : [];
  return {
    directive,
    handoffPath,
    spawnArgv: ['claude', '-p', `/${directive.skill} 继续 ${directive.stage} 环；交接上下文：${path.basename(handoffPath)}`],
    trackerCommands,
  };
}

/** IO orchestration only: the routing decision comes from the T1 pure function via planSpawnNext. */
export function executeSpawnNext(chain: SpawnNextChain, directory: string, spawnFn: SpawnFn = defaultSpawnFn): void {
  const plan = planSpawnNext(chain, getOmcRoot(directory));
  if (!plan) return;
  fs.mkdirSync(path.dirname(plan.handoffPath), { recursive: true });
  fs.writeFileSync(plan.handoffPath, JSON.stringify({
    sessionId: chain.sessionId,
    from: { outcome: chain.outcome, reason: chain.reason },
    next: plan.directive,
    context: chain.handoffContext ?? '',
  }, null, 2), 'utf8');
  try {
    spawnFn(plan.spawnArgv[0], plan.spawnArgv.slice(1));
  } catch (error) {
    if (chain.tracker) {
      spawnFn('gh', ['issue', 'comment', String(chain.tracker.issue), '--repo', chain.tracker.repo, '--body', spawnNextAlertComment(chain)]);
      spawnFn('gh', ['issue', 'edit', String(chain.tracker.issue), '--repo', chain.tracker.repo, '--add-label', chain.tracker.failedLabel]);
    }
    throw error;
  }
  for (const command of plan.trackerCommands) {
    const [name, ...args] = command.split(' ');
    spawnFn(name, args);
  }
}

function defaultSpawnFn(command: string, args: string[]): { unref(): void } {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true, shell: true });
  child.unref();
  return child;
}
