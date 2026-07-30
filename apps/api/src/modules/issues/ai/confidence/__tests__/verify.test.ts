import { describe, expect, it } from "vitest";
import {
  hasValidCitation,
  verifyCitedFacts,
} from "@/modules/issues/ai/confidence/verify";
import type { AgentDecision } from "@/modules/issues/ai/agent/output-schema";
import type { IssueRow } from "@/modules/issues/types";

const issue = {
  id: "00000000-0000-0000-0000-000000000001",
  externalId: "iss_004",
  type: "refund_request",
  customerId: "cust_042",
  transactionId: "txn_5998",
  amount: 149,
  merchant: "HomeEssentials",
  status: "processing",
  metadata: { reason: "changed_mind", days_since_purchase: 3 },
} as unknown as IssueRow;

const decision = (over: Partial<AgentDecision> = {}): AgentDecision => ({
  recommendation: "auto_resolve",
  confidence: 0.95,
  reasoning: "r",
  trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
  citedFacts: [
    { source: "transaction", path: "shipping.status", value: "not_shipped" },
  ],
  dataGap: null,
  ...over,
});

describe("verifyCitedFacts", () => {
  it("passes when every cited fact matches source data", () => {
    expect(verifyCitedFacts(decision(), issue)).toEqual({ ok: true });
  });

  it("fails when a cited fact contradicts the source record", () => {
    // The hallucination guard: the model claims the parcel shipped when
    // txn_5998 says not_shipped. Money must never move on this.
    const result = verifyCitedFacts(
      decision({
        citedFacts: [
          { source: "transaction", path: "shipping.status", value: "delivered" },
        ],
      }),
      issue,
    );
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      mismatches: [expect.stringContaining("shipping.status")],
    });
  });

  it("fails when the cited path does not exist", () => {
    const result = verifyCitedFacts(
      decision({
        citedFacts: [{ source: "customer", path: "credit_score", value: "780" }],
      }),
      issue,
    );
    expect(result.ok).toBe(false);
  });

  it("reads issue-level facts out of metadata", () => {
    expect(
      verifyCitedFacts(
        decision({
          citedFacts: [
            { source: "issue", path: "days_since_purchase", value: "3" },
          ],
        }),
        issue,
      ),
    ).toEqual({ ok: true });
  });

  it("compares values loosely on case and surrounding whitespace", () => {
    expect(
      verifyCitedFacts(
        decision({
          citedFacts: [
            { source: "transaction", path: "shipping.status", value: " NOT_SHIPPED " },
          ],
        }),
        issue,
      ),
    ).toEqual({ ok: true });
  });

  it("passes vacuously when the agent cited no facts", () => {
    // Not a free pass: a decision with no citable facts still has to clear
    // hasValidCitation and the confidence caps.
    expect(verifyCitedFacts(decision({ citedFacts: [] }), issue)).toEqual({ ok: true });
  });
});

describe("hasValidCitation", () => {
  it("accepts a trace citing a real policies.md line", () => {
    expect(hasValidCitation(decision())).toBe(true);
  });

  it("rejects a trace citing a line past the end of the file", () => {
    expect(
      hasValidCitation(
        decision({ trace: [{ src: 9999, rule: "r", status: "fired", evidence: "e" }] }),
      ),
    ).toBe(false);
  });

  it("rejects a trace citing a blank line", () => {
    // Injected instructions have no line number in policies.md, and a blank
    // line is not a rule. No citation, no execution.
    // Line 2 is the blank line after the title (line 5 is now the `---`
    // separator, which has non-empty trim and would pass).
    expect(
      hasValidCitation(
        decision({ trace: [{ src: 2, rule: "r", status: "fired", evidence: "e" }] }),
      ),
    ).toBe(false);
  });
});
