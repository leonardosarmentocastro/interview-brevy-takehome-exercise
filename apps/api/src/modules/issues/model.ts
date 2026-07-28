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
