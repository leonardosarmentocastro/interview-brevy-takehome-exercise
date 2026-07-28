import { describe, expect, it } from "vitest";
import { createIssueSchema } from "@/modules/issues/schema";
import { toIssueRow } from "@/modules/issues/normalizer";

const decline = {
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

const missedInstallment = {
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

describe("toIssueRow", () => {
  it("maps core fields, sets external_id from source id, sweeps the tail into metadata", () => {
    const row = toIssueRow(createIssueSchema.parse(decline));
    expect(row.externalId).toBe("iss_001");
    expect(row.type).toBe("decline");
    expect(row.customerId).toBe("cust_042");
    expect(row.transactionId).toBe("txn_5521");
    expect(row.amount).toBe(89.99);
    expect(row.merchant).toBe("TechGadgets.com");
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.metadata).toMatchObject({
      error_code: "insufficient_funds",
      auto_retry_count: 2,
    });
    // core fields must NOT be duplicated into metadata
    expect(row.metadata).not.toHaveProperty("id");
    expect(row.metadata).not.toHaveProperty("amount");
  });

  it("normalizes amount_due -> amount, keeps raw amount_due in metadata, merchant null", () => {
    const row = toIssueRow(createIssueSchema.parse(missedInstallment));
    expect(row.amount).toBe(62.5);
    expect(row.merchant).toBeNull();
    expect(row.metadata).toMatchObject({
      amount_due: 62.5,
      installment_number: 3,
      installments_total: 4,
      days_overdue: 5,
    });
  });
});
