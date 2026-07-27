import { describe, expect, it } from "vitest";
import { joinIssues } from "@/modules/operators/utils/join-issues";

const NOW = "2025-01-13T12:00:00Z";
const customers = [{ id: "cust_1", name: "Morgan L.", risk_score: "low", lifetime_spend: 312 }];
const transactions = [{ id: "txn_1", merchant: "HomeEssentials", created_at: "2025-01-10T00:00:00Z" }];
const issues = [{ id: "iss_1", customer_id: "cust_1", transaction_id: "txn_1", type: "dispute", amount: 249, merchant: "HomeEssentials" }];

describe("joinIssues", () => {
  it("joins customer + transaction + decision and builds display fields", () => {
    const [vm] = joinIssues({ customers, transactions, issues } as never, { iss_1: { lane: "in_review" } }, NOW);
    expect(vm.display.customerName).toBe("Morgan L.");
    expect(vm.display.amountText).toBe("$249.00");
    expect(vm.display.typeLabel).toBe("Dispute");
    expect(vm.display.ageDays).toBe(3);
    expect(vm.display.isHighValue).toBe(false); // 312 < 2000
    expect(vm.decision?.lane).toBe("in_review");
  });

  it("prefers issue.days_since_purchase when present", () => {
    const withDays = [{ ...issues[0], days_since_purchase: 2 }];
    const [vm] = joinIssues({ customers, transactions, issues: withDays } as never, {}, NOW);
    expect(vm.display.ageDays).toBe(2);
  });
});
