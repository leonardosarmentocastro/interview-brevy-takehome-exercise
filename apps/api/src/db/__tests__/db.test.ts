import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { issueDecisions, issues } from "@/modules/issues/model";

describe("persistence pack", () => {
  it("connects and the issues table is queryable", async () => {
    const rows = await db.select().from(issues);
    expect(rows).toEqual([]);
  });

  it("stores an agent decision with its confidence arithmetic", async () => {
    const [issue] = await db
      .insert(issues)
      .values({
        externalId: "iss_agent_cols",
        type: "refund_request",
        customerId: "cust_042",
        transactionId: "txn_5998",
        amount: 149,
        createdAt: new Date(),
      })
      .returning();

    const [decision] = await db
      .insert(issueDecisions)
      .values({
        issueId: issue.id,
        actor: "agent",
        decision: "resolve",
        justification: "Within the window and unshipped.",
        decidedBy: "claude-opus-5",
        recommendation: "auto_resolve",
        confidence: 0.95,
        confidenceBase: 0.95,
        routingBand: "auto_execute",
        scoreBreakdown: { base: 0.95, penalties: [], caps: [], final: 0.95 },
        trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
      })
      .returning();

    expect(decision.confidence).toBe(0.95);
    expect(decision.routingBand).toBe("auto_execute");
    expect(decision.trace).toHaveLength(1);
  });
});
