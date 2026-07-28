import type { CreateIssueInput } from "@/modules/issues/schema";

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

// Turns a validated create-issue body into the storage row: core fields ->
// columns, everything else (incl. the raw `amount_due`) -> `metadata`, and
// `amount` normalized from `amount ?? amount_due`.
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
