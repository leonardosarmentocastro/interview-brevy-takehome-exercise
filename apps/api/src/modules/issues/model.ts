import {
  pgTable,
  uuid,
  text,
  numeric,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const issueType = pgEnum("issue_type", [
  "decline",
  "missed_installment",
  "dispute",
  "refund_request",
]);

export const issueStatus = pgEnum("issue_status", [
  "pending",
  "processing",
  "needs_review",
  "on_hold",
  "resolved",
  "escalated",
]);

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The issue's id in the upstream/source system (e.g. "iss_001"). Unique so a
  // re-submitted or re-seeded issue can't double-insert (idempotency seam).
  externalId: text("external_id").notNull().unique(),
  type: issueType("type").notNull(),
  customerId: text("customer_id").notNull(),
  transactionId: text("transaction_id").notNull(),
  // Normalized money figure (amount ?? amount_due). numeric mode:"number"
  // returns a JS number on select.
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  merchant: text("merchant"), // nullable — absent on missed_installment
  status: issueStatus("status").notNull().default("pending"),
  // Type-specific tail (error_code, days_overdue, reason, raw amount_due, ...).
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), // source time
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(), // system time
});

// actor that authored a decision. Only "human" is written today; the AI cycle
// adds the "agent" branch (additive — nullable trace columns join later).
export const decisionActor = pgEnum("decision_actor", ["human", "agent"]);

// Append-only record of a decision taken on an issue.
export const issueDecisions = pgTable("issue_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id),
  actor: decisionActor("actor").notNull(),
  decision: text("decision").notNull(), // human: 'resolve' | 'escalate' | 'hold'; agent: 'resolve' | 'escalate' | 'defer'
  justification: text("justification").notNull(),
  decidedBy: text("decided_by").notNull(), // reviewer identifier
  // --- agent-only, all nullable: a human review leaves every one of these
  // null, and an agent decision fills them all. Additive so no existing row
  // or query changes.

  // The agent's raw verdict, kept distinct from `decision` (the verb actually
  // applied). A capped decision recommends `auto_resolve` while applying
  // `defer` — that divergence is the point, so both are recorded.
  recommendation: text("recommendation"),
  // Final score, after penalties and caps.
  confidence: numeric("confidence", { precision: 4, scale: 3, mode: "number" }),
  // The model's own self-report, before deterministic adjustment. Storing both
  // is what makes agent calibration measurable later.
  confidenceBase: numeric("confidence_base", {
    precision: 4,
    scale: 3,
    mode: "number",
  }),
  routingBand: text("routing_band"), // auto_execute | execute_flagged | human_decision
  // The arithmetic, so a reviewer can check the score rather than trust it.
  scoreBreakdown: jsonb("score_breakdown"),
  // The cited rule-by-rule trace, each entry naming a policies.md line.
  trace: jsonb("trace"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only log of every status transition. from_status null = intake (birth).
export const issueStatusHistory = pgTable("issue_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id),
  fromStatus: issueStatus("from_status"),
  toStatus: issueStatus("to_status").notNull(),
  actor: text("actor").notNull(), // 'system' (intake, worker) | 'human'
  // Why this transition happened. Set by the worker when it parks an issue
  // (e.g. "processing failed permanently: …"); null for human reviews, whose
  // rationale lives in the linked decision's `justification`.
  reason: text("reason"),
  decisionId: uuid("decision_id").references(() => issueDecisions.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
