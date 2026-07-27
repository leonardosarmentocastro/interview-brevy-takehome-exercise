import { z } from "zod";

const base = {
  id: z.string().min(1),
  customer_id: z.string().min(1),
  transaction_id: z.string().min(1),
  created_at: z.string().min(1),
};

// `.passthrough()` keeps unknown keys so a not-yet-modeled field still flows
// into `metadata` instead of being rejected (non-strict branches).
const decline = z
  .object({
    ...base,
    type: z.literal("decline"),
    amount: z.number(),
    merchant: z.string(),
    error_code: z.enum(["insufficient_funds", "card_expired"]),
    auto_retry_count: z.number().optional(),
    is_recurring: z.boolean().optional(),
  })
  .passthrough();

const missedInstallment = z
  .object({
    ...base,
    type: z.literal("missed_installment"),
    amount_due: z.number(),
    installment_number: z.number(),
    installments_total: z.number(),
    days_overdue: z.number(),
  })
  .passthrough();

const dispute = z
  .object({
    ...base,
    type: z.literal("dispute"),
    amount: z.number(),
    merchant: z.string(),
    reason: z.string().min(1),
    days_since_purchase: z.number(),
  })
  .passthrough();

const refundRequest = z
  .object({
    ...base,
    type: z.literal("refund_request"),
    amount: z.number(),
    merchant: z.string(),
    reason: z.string().min(1),
    days_since_purchase: z.number(),
    installment_plan: z.boolean().optional(),
    installments_paid: z.number().optional(),
  })
  .passthrough();

export const createIssueSchema = z.discriminatedUnion("type", [
  decline,
  missedInstallment,
  dispute,
  refundRequest,
]);

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export type NewIssueRow = {
  externalId: string;
  type: CreateIssueInput["type"];
  customerId: string;
  transactionId: string;
  amount: number;
  merchant: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

// Keys that map to typed columns; everything else is the type-specific tail.
const COLUMN_KEYS = new Set([
  "id",
  "type",
  "customer_id",
  "transaction_id",
  "amount",
  "merchant",
  "created_at",
]);

export const toIssueRow = (input: CreateIssueInput): NewIssueRow => {
  const raw = input as Record<string, unknown>;

  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    // amount_due is intentionally NOT a column, so it stays in metadata.
    if (!COLUMN_KEYS.has(key)) metadata[key] = value;
  }

  const amount =
    typeof raw.amount === "number" ? raw.amount : (raw.amount_due as number);
  const merchant = typeof raw.merchant === "string" ? raw.merchant : null;

  return {
    externalId: input.id,
    type: input.type,
    customerId: input.customer_id,
    transactionId: input.transaction_id,
    amount,
    merchant,
    metadata,
    createdAt: new Date(input.created_at),
  };
};
