import { describe, expect, it } from "vitest";
import {
  findCustomer,
  findTransaction,
  policyLine,
  policyLineCount,
} from "@/modules/issues/ai/data/records";

describe("records", () => {
  it("finds a customer by id", () => {
    expect(findCustomer("cust_042")?.lifetime_spend).toBe(1847.5);
  });

  it("returns undefined for an unknown customer", () => {
    expect(findCustomer("cust_nope")).toBeUndefined();
  });

  it("finds a transaction by id", () => {
    const txn = findTransaction("txn_5998");
    expect(txn?.shipping).toMatchObject({ status: "not_shipped" });
  });

  it("reads policies.md as 1-indexed lines", () => {
    // :63 is the fraud rule the fraud cap cites. If this fails, policies.md
    // shifted and every cap's `src` needs rechecking.
    expect(policyLine(63)).toContain("Never");
    expect(policyLine(53)).toContain("$200");
    expect(policyLineCount).toBeGreaterThan(80);
  });
});
