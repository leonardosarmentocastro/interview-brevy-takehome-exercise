import { pool } from "@/db/client";

export const declineBody = {
  id: "iss_001",
  type: "decline",
  transaction_id: "txn_5521",
  customer_id: "cust_042",
  error_code: "insufficient_funds",
  amount: 89.99,
  merchant: "TechGadgets.com",
  created_at: "2025-01-13T03:22:00Z",
  auto_retry_count: 2,
};

export const missedInstallmentBody = {
  id: "iss_002",
  type: "missed_installment",
  transaction_id: "txn_4892",
  customer_id: "cust_108",
  installment_number: 3,
  installments_total: 4,
  amount_due: 62.5,
  days_overdue: 5,
  created_at: "2025-01-12T00:00:00Z",
};

export const postIssue = (base: string, body: unknown) =>
  fetch(`${base}/issues`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// Arrange a reviewable precondition. Issues are born `pending` (not reviewable);
// in production the queue/agent moves them on. Tests set the status directly.
export const setIssueStatus = (externalId: string, status: string) =>
  pool.query("UPDATE issues SET status = $1 WHERE external_id = $2", [
    status,
    externalId,
  ]);
