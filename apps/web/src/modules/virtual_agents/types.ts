export type LogKind = "grab" | "resolved" | "leak" | "escalated";

export type LogEntry = {
  t: string;
  kind: LogKind;
  text: string;
  refs: number[];
};

export type FactPair = [string, string];

export type IntakeItem = {
  id: string;
  type: string;
  amountText: string;
  meta: string;
  facts: {
    ticket: FactPair[];
    customer: FactPair[];
  };
};

export type WaitItem = {
  id: string;
  type: string;
  amountText: string;
  meta: string;
  blocker: string;
};

export type ResolvedRecent = {
  id: string;
  typeShort: string;
  note: string;
};

export type ResolvedLane = {
  count: number;
  recent: ResolvedRecent[];
};

export type DrillChip = {
  cat: string;
  label: string;
  n: number;
};

export type DrillRow = {
  id: string;
  cat: string;
  type: string;
  amountText: string;
  customer: string;
  time: string;
  rule: number;
  analysis: string;
  txt: string;
};

export type DrillData = {
  total: number;
  chips: DrillChip[];
  rows: DrillRow[];
  pattern: { count: number; total: number; rule: number };
};

export type TraceStatus = "fired" | "applied" | "not_met" | "cant_evaluate";

export type AnalysisTrace = {
  src: number;
  status: TraceStatus | string;
  rule: string;
  evidence: string;
};

export type AnalysisRecord = {
  id: string;
  txnId: string;
  resolvedAt: string;
  type: string;
  amountText: string;
  rec: { lead: string; because: string; ref: number };
  trace: AnalysisTrace[];
  conclusion: string;
  context: FactPair[];
  audit: string;
};

export type SimDest = "waiting" | "resolved" | "human_review";

export type SimPoolTicket = {
  id: string;
  type: string;
  amountText: string;
  meta: string;
  dest: SimDest;
  destNote?: string;
  blocker?: string;
  reason?: string;
  rule: number;
};

export type MonitorStats = {
  resolved: number;
  autoPct: number;
  waiting: number;
  humanReview: number;
  escalated: number;
};

export type MonitorSnapshot = {
  stats: MonitorStats;
  log: LogEntry[];
  intake: IntakeItem[];
  waiting: WaitItem[];
  waitingMore: number;
  resolved: ResolvedLane;
  drill: DrillData;
  analysis: Record<string, AnalysisRecord>;
  simPool: SimPoolTicket[];
  simLeak: SimPoolTicket;
};

export type SimTicket = SimPoolTicket & {
  dest: SimDest;
};
