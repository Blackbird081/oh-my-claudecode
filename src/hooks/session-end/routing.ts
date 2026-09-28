export type ChainOutcome = 'success' | 'failed' | 'needs-human';

export interface ChainDirective {
  stage: string;
  skill: string;
}

export type RouteTable = Readonly<Record<string, ChainDirective>>;

export function decideNextStage(outcome: ChainOutcome, reason: string, table: RouteTable): ChainDirective | null {
  return table[`${outcome}:${reason}`] ?? table[`${outcome}:*`] ?? null;
}

export type GateName = 'intent-accept' | 'spec-approve' | 'harbor-review' | 'review-approve';

export interface GateFacts {
  irreversibleOrExternal: boolean;
  precedentSetting: boolean;
  valueJudgment: boolean;
  mechanicalChecksPassed: boolean;
}

export type GateVerdict =
  | { kind: 'human'; criterion: string }
  | { kind: 'auto-pass'; signerFact: string };

const HUMAN_ONLY_GATES: ReadonlySet<GateName> = new Set(['intent-accept', 'review-approve']);

const CRITERIA: ReadonlyArray<[keyof Pick<GateFacts, 'irreversibleOrExternal' | 'precedentSetting' | 'valueJudgment'>, string]> = [
  ['irreversibleOrExternal', '判据一：不可逆或外部可见'],
  ['precedentSetting', '判据二：先例性'],
  ['valueJudgment', '判据三：价值判断'],
];

export function gradeGate(gate: GateName, facts: GateFacts): GateVerdict {
  if (gate === 'intent-accept') return { kind: 'human', criterion: '保留人闸：价值判断 + 消耗下游整条链，v1 无自动通道' };
  if (gate === 'review-approve') return { kind: 'human', criterion: '保留人闸：合并不可逆且外部可见（判据一），v1 无黑区' };
  for (const [key, label] of CRITERIA) {
    if (facts[key]) return { kind: 'human', criterion: label };
  }
  if (!facts.mechanicalChecksPassed) return { kind: 'human', criterion: '机械验证项未全部通过' };
  return { kind: 'auto-pass', signerFact: '分级判据均未触发，机械验证项全部通过，自动过' };
}
