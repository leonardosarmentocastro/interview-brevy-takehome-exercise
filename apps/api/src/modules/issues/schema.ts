import { z } from "zod";

const base = {
  id: z.string().min(1),
  customer_id: z.string().min(1),
  transaction_id: z.string().min(1),
  created_at: z.string().min(1),
};

// `.loose()` keeps unknown keys so a not-yet-modeled field still flows into
// `metadata` instead of being rejected (non-strict branches).
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
  .loose();

const missedInstallment = z
  .object({
    ...base,
    type: z.literal("missed_installment"),
    amount_due: z.number(),
    installment_number: z.number(),
    installments_total: z.number(),
    days_overdue: z.number(),
  })
  .loose();

const dispute = z
  .object({
    ...base,
    type: z.literal("dispute"),
    amount: z.number(),
    merchant: z.string(),
    reason: z.string().min(1),
    days_since_purchase: z.number(),
  })
  .loose();

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
  .loose();

export const createIssueSchema = z.discriminatedUnion("type", [
  decline,
  missedInstallment,
  dispute,
  refundRequest,
]);

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
