import { acquireChainSlot, releaseChainSlot } from 'file:///D:/aiLocal/oh-my-claudecode/.claude/worktrees/factory/.claude/worktrees/t6-acceptance/dist/hooks/session-end/guardrails.js';
import { executeSpawnNext, planSpawnNext } from 'file:///D:/aiLocal/oh-my-claudecode/.claude/worktrees/factory/.claude/worktrees/t6-acceptance/dist/hooks/session-end/spawn-next.js';
import { gradeGate } from 'file:///D:/aiLocal/oh-my-claudecode/.claude/worktrees/factory/.claude/worktrees/t6-acceptance/dist/hooks/session-end/routing.js';
import fs from 'fs';

const stateRoot = 'C:/Users/Administrator/AppData/Local/Temp/factory-demo/.omc/state/factory';
const DEMO_TABLE = { 'success:intent-accepted': { stage: 'launch', skill: 'launch' } };

// 1. intent-accept gate verdict (human) — recorded fact
const gate = gradeGate('intent-accept', { irreversibleOrExternal: false, precedentSetting: false, valueJudgment: true, mechanicalChecksPassed: true });
console.log('GATE:', JSON.stringify(gate));

// 2. guardrail slot for the return-refund-flow chain
const slot = acquireChainSlot('return-refund-flow', stateRoot);
console.log('SLOT:', slot.allowed ? `allowed linkIndex=${slot.linkIndex} dateKey=${slot.dateKey}` : JSON.stringify(slot));
if (!slot.allowed) process.exit(1);

try {
  // 3. plan + real chain advance (defaultSpawnFn: detached claude spawn)
  const chain = {
    outcome: 'success',
    reason: 'intent-accepted',
    routeTable: DEMO_TABLE,
    sessionId: 'return-refund-flow',
    handoffContext: 'docs/intents/return-refund-flow/intent.md（intent 已通过 intent-accept 人闸，接受记录见 issue #1 评论 5866386028；未决 3 条带入 launch 逐条消化）',
    tracker: { repo: 'pangpang778/factory-demo', issue: 1, nextLabel: 'launch', failedLabel: 'failed' },
  };
  const plan = planSpawnNext(chain, 'C:/Users/Administrator/AppData/Local/Temp/factory-demo/.omc');
  console.log('PLAN:', JSON.stringify(plan, null, 2));
  executeSpawnNext(chain, 'C:/Users/Administrator/AppData/Local/Temp/factory-demo');
  console.log('EXECUTED: handoff written, spawn fired, tracker commands fired');
} finally {
  releaseChainSlot(slot);
  console.log('SLOT released');
}
