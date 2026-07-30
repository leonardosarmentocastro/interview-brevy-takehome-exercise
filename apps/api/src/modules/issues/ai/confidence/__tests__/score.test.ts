import { describe, expect, it } from "vitest";
import { score } from "@/modules/issues/ai/confidence/score";
import type { AgentDecision } from "@/modules/issues/ai/agent/output-schema";
import type { IssueRow } from "@/modules/issues/types";

const cleanIssue = {
  id: "00000000-0000-0000-0000-000000000001",
  type: "refund_request",
  customerId: "cust_042",
  transactionId: "txn_5998",
  amount: 149,
  metadata: { reason: "changed_mind" },
} as unknown as IssueRow;

const fraudIssue = {
  ...cleanIssue,
  type: "dispute",
  metadata: { reason: "unauthorized_transaction" },
} as unknown as IssueRow;

const decision = (over: Partial<AgentDecision> = {}): AgentDecision => ({
  recommendation: "auto_resolve",
  confidence: 0.95,
  reasoning: "r",
  trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
  citedFacts: [],
  dataGap: null,
  ...over,
});

describe("score", () => {
  it("passes the base through untouched when nothing applies", () => {
    // iss_004's shape: no cap fires, no gaps. A clean case must still be
    // able to reach the auto-execute band.
    const result = score(decision(), cleanIssue);
    expect(result.final).toBe(0.95);
    expect(result.penalties).toEqual([]);
    expect(result.caps).toEqual([]);
  });

  it("subtracts 0.15 per cant_evaluate trace node", () => {
    const result = score(
      decision({
        confidence: 0.88,
        trace: [
          { src: 37, rule: "r", status: "cant_evaluate", evidence: "e" },
          { src: 38, rule: "r", status: "fired", evidence: "e" },
        ],
      }),
      cleanIssue,
    );
    expect(result.final).toBe(0.73);
  });

  it("subtracts 0.10 for a declared data gap", () => {
    expect(score(decision({ confidence: 0.9, dataGap: "no merchant history" }), cleanIssue).final).toBe(0.8);
  });

  it("drops a band once two rules are unevaluable", () => {
    // Bands are 20 points wide, so -0.15 is meaningful but not automatically
    // band-dropping; two always are. One gap is tolerable, compounding gaps
    // are not.
    const result = score(
      decision({
        confidence: 0.95,
        trace: [
          { src: 13, rule: "r", status: "cant_evaluate", evidence: "e" },
          { src: 16, rule: "r", status: "cant_evaluate", evidence: "e" },
        ],
      }),
      cleanIssue,
    );
    expect(result.final).toBe(0.65);
  });

  it("lets a cap beat a confident base", () => {
    // The whole reason the layers are ordered rather than weighted: a
    // weighted average would put this at ~0.72 and auto-execute a fraud claim.
    const result = score(decision({ confidence: 0.99 }), fraudIssue);
    expect(result.final).toBe(0.69);
    expect(result.caps).toContainEqual(
      expect.objectContaining({ src: 63 }),
    );
  });

  it("never raises a score — a cap above the base is inert", () => {
    expect(score(decision({ confidence: 0.4 }), fraudIssue).final).toBe(0.4);
  });

  it("floors at zero", () => {
    expect(
      score(
        decision({
          confidence: 0.1,
          dataGap: "everything",
          trace: [{ src: 13, rule: "r", status: "cant_evaluate", evidence: "e" }],
        }),
        cleanIssue,
      ).final,
    ).toBe(0);
  });

  it("records the arithmetic so a reviewer can check it", () => {
    const result = score(decision({ confidence: 0.88, dataGap: "x" }), cleanIssue);
    expect(result).toMatchObject({
      base: 0.88,
      penalties: [{ reason: "data gap declared", amount: 0.1 }],
      final: 0.78,
    });
  });
});
