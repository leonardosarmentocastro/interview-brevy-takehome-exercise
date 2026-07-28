import { describe, expect, it } from "vitest";
import { createIssueSchema } from "@/modules/issues/schema";

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

describe("createIssueSchema", () => {
  it("accepts a valid decline and rejects one missing error_code", () => {
    expect(createIssueSchema.safeParse(decline).success).toBe(true);
    const { error_code, ...noCode } = decline;
    expect(createIssueSchema.safeParse(noCode).success).toBe(false);
  });

  it("rejects an unknown issue type", () => {
    expect(
      createIssueSchema.safeParse({ ...decline, type: "chargeback" }).success,
    ).toBe(false);
  });
});
