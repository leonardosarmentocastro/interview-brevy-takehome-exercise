import { describe, expect, it } from "vitest";
import { capsFor, ceilingOf } from "@/modules/issues/ai/confidence/caps";
import type { IssueRow } from "@/modules/issues/types";

const issue = (over: Partial<IssueRow> & { metadata?: unknown } = {}): IssueRow =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    type: "dispute",
    customerId: "cust_217", // lifetime spend 312.00
    transactionId: "txn_6103",
    amount: 100,
    metadata: {},
    ...over,
  }) as unknown as IssueRow;

describe("capsFor", () => {
  it("caps fraud claims below the auto-execute band", () => {
    const caps = capsFor(
      issue({ metadata: { reason: "unauthorized_transaction" } }),
    );
    expect(caps).toContainEqual({
      ceiling: 0.69,
      reason: "fraud claims are never auto-resolved",
      src: 63,
    });
  });

  it("caps a dispute over $200", () => {
    expect(capsFor(issue({ amount: 249 }))).toContainEqual({
      ceiling: 0.89,
      reason: "dispute amount exceeds $200",
      src: 53,
    });
  });

  it("does not cap a dispute at exactly $200", () => {
    // The policy says "exceeds", so the boundary itself is not a trigger.
    expect(capsFor(issue({ amount: 200 }))).toEqual([]);
  });

  it("caps a high-value customer", () => {
    // cust_315 has lifetime spend 4205.00
    expect(capsFor(issue({ customerId: "cust_315" }))).toContainEqual({
      ceiling: 0.89,
      reason: "customer lifetime spend exceeds $2000",
      src: 88,
    });
  });

  it("does not cap a customer under the high-value threshold", () => {
    // cust_042 has lifetime spend 1847.50
    expect(capsFor(issue({ customerId: "cust_042" }))).toEqual([]);
  });

  it("caps an issue type policies.md does not cover", () => {
    expect(
      capsFor(issue({ type: "chargeback_reversal" as IssueRow["type"] })),
    ).toContainEqual({
      ceiling: 0.69,
      reason: "issue type not covered by policies.md",
      src: 86,
    });
  });

  it("returns no caps for a clean refund request", () => {
    expect(
      capsFor(
        issue({
          type: "refund_request",
          customerId: "cust_042",
          amount: 149,
          metadata: { reason: "changed_mind" },
        }),
      ),
    ).toEqual([]);
  });

  it("accumulates every cap that applies", () => {
    expect(
      capsFor(
        issue({
          amount: 249,
          customerId: "cust_315",
          metadata: { reason: "unauthorized_transaction" },
        }),
      ),
    ).toHaveLength(3);
  });
});

describe("ceilingOf", () => {
  it("is 1 when nothing caps", () => {
    expect(ceilingOf([])).toBe(1);
  });

  it("takes the lowest ceiling — any factor can veto, none can rescue", () => {
    expect(
      ceilingOf([
        { ceiling: 0.89, reason: "a", src: 53 },
        { ceiling: 0.69, reason: "b", src: 63 },
      ]),
    ).toBe(0.69);
  });
});
