export type Lane = "needs_review" | "in_review" | "on_hold" | "resolved";

export type Customer = {
  id: string;
  email: string;
  name: string;
  account_created: string;
  lifetime_transactions: number;
  lifetime_spend: number;
  successful_payments: number;
  failed_payments: number;
  disputes_filed: number;
  disputes_won: number;
  current_installment_plans: number;
  risk_score: string;
  notes?: string;
};

export type InstallmentPlan = {
  total_installments: number;
  amount_per_installment: number;
  installments_paid: number;
  next_due_date: string;
};

export type Shipping = {
  carrier: string;
  tracking_number: string;
  status: string;
  estimated_delivery?: string;
  estimated_ship_date?: string;
  last_update?: string;
  last_location?: string;
};

export type Subscription = {
  months_active: number;
  monthly_amount: number;
  next_box_ships: string;
};

export type Transaction = {
  id: string;
  customer_id: string;
  merchant: string;
  amount: number;
  payment_method: string;
  status: string;
  failure_reason?: string;
  created_at: string;
  installment_plan?: InstallmentPlan | null;
  shipping?: Shipping;
  is_recurring?: boolean;
  subscription?: Subscription;
};

export type Issue = {
  id: string;
  type: string;
  transaction_id: string;
  customer_id: string;
  amount?: number;
  merchant?: string;
  created_at: string;
  error_code?: string;
  auto_retry_count?: number;
  installment_number?: number;
  installments_total?: number;
  amount_due?: number;
  days_overdue?: number;
  reason?: string;
  days_since_purchase?: number;
  installment_plan?: boolean;
  installments_paid?: number;
  is_recurring?: boolean;
};

export type TraceStatus = "fired" | "not_met" | "cant_evaluate";

export type TraceNode = {
  src: number;
  status: TraceStatus;
  rule: string;
  evidence: string;
};

export type DecisionWhy = {
  face: "escalate" | "recommend" | "no_rule";
  lead: string;
  because: string;
  ref?: number;
};

export type DecisionAction = {
  label: string;
  sub?: string;
  variant?: string;
  danger?: boolean;
};

export type DecisionActivity = {
  t: string;
  text: string;
  who: string;
};

export type Decision = {
  lane: Lane;
  owner?: string;
  typeLabelOverride?: string;
  statusLabel?: string;
  urgency?: { level: "breach" | "soon" | "none"; label: string };
  why?: DecisionWhy;
  trace?: TraceNode[];
  dataGap?: { text: string } | null;
  related?: string[];
  actions?: {
    recommended: DecisionAction | null;
    others: DecisionAction[];
  };
  activity?: DecisionActivity[];
};

export type IssueDisplay = {
  id: string;
  txnId: string;
  typeLabel: string;
  amount: number;
  amountText: string;
  customerName: string;
  custId: string;
  merchant: string;
  ageDays: number;
  riskScore: string;
  lifetimeSpend: number;
  isHighValue: boolean;
};

export type IssueViewModel = {
  issue: Issue;
  transaction: Transaction | null;
  customer: Customer | null;
  decision: Decision | null;
  display: IssueDisplay;
};

export type BoardColumns = Record<Lane, IssueViewModel[]>;

export type AgentSummaryCategory = {
  name: string;
  resolved: number;
  waiting: number;
  backlog: number;
  escalated: number;
};

export type AgentSummary = {
  totals: {
    resolved: number;
    waiting: number;
    backlog: number;
    escalated: number;
  };
  categories: AgentSummaryCategory[];
};
