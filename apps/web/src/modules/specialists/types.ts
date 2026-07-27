export type UrgencyKind = "act" | "breach" | "reval";

export type UrgencyBar = {
  fillPct: number;
  kind: UrgencyKind;
  word: string;
  limit: string;
  elapsed: string;
};

export type CardProvenance = {
  mode: "auto" | "manual";
  reason: string;
  ref: number;
};

export type SpecialistCard = {
  id: string;
  type: string;
  amountText: string;
  meta: string;
  crit: "crit" | "high" | "mod";
  tier: string;
  cat: string;
  bar: UrgencyBar | null;
  prov: CardProvenance;
  breach?: boolean;
  highValue?: boolean;
  owner?: string;
  outcome?: string;
  claimed?: boolean;
};

export type SpecialistSnapshot = {
  online: number;
  breakdown: string;
  queue: SpecialistCard[];
  mine: {
    investigating: SpecialistCard[];
    onhold: SpecialistCard[];
    resolved: SpecialistCard[];
  };
  cases: Record<string, SpecialistCase>;
};

export type CaseHistoryNode = {
  actor: string;
  actorClass?: string;
  when?: string;
  t?: string;
  line?: string;
  val?: string;
  ref?: number;
  st?: string;
  fired?: boolean;
  rows?: [string, string][];
  note?: string;
  end?: boolean;
  endCrit?: string;
  concl?: string;
};

export type CaseProvenance = {
  mode: "auto" | "manual";
  by: string;
  because: string;
  refs: number[];
};

export type CaseRailAction = {
  label: string;
  sub: string;
  variant?: "go" | "esc";
};

export type SpecialistCase = {
  id: string;
  txnId: string;
  type: string;
  amountText: string;
  tier: string;
  crit: "crit" | "high" | "mod";
  status: string;
  bar: UrgencyBar | null;
  prov: CaseProvenance;
  history: CaseHistoryNode[];
  dataGap: { html: string; staged?: string };
  context: {
    left: { title: string; rows: [string, string, string?][] };
    right: { title: string; rows: [string, string, string?][] };
  };
  related: string;
  rail: {
    resolve: CaseRailAction[];
    other: CaseRailAction[];
  };
  terminalNote: string;
};
