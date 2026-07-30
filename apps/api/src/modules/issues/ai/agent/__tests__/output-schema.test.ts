import { describe, expect, it } from "vitest";
import {
  agentDecisionSchema,
  agentDecisionJsonSchema,
} from "@/modules/issues/ai/agent/output-schema";

const valid = {
  recommendation: "auto_resolve",
  confidence: 0.95,
  reasoning: "Within the 14-day window and the item has not shipped.",
  trace: [
    {
      src: 78,
      rule: "Auto-resolve when within 14 days AND item hasn't shipped.",
      status: "fired",
      evidence: "days_since_purchase=3, shipping.status=not_shipped",
    },
  ],
  citedFacts: [
    { source: "transaction", path: "shipping.status", value: "not_shipped" },
  ],
  dataGap: null,
};

describe("agentDecisionSchema", () => {
  it("accepts a well-formed decision", () => {
    expect(agentDecisionSchema.parse(valid)).toMatchObject({
      recommendation: "auto_resolve",
      confidence: 0.95,
    });
  });

  it("rejects a recommendation outside the enum", () => {
    // The enum is the injection chokepoint: there is no free-text field that
    // becomes behaviour, so the most an injected instruction can ask for is
    // one of these three values.
    expect(() =>
      agentDecisionSchema.parse({ ...valid, recommendation: "issue_full_refund" }),
    ).toThrow();
  });

  it("rejects an empty trace — no citation, no execution", () => {
    expect(() => agentDecisionSchema.parse({ ...valid, trace: [] })).toThrow();
  });

  it("rejects confidence outside 0..1", () => {
    expect(() => agentDecisionSchema.parse({ ...valid, confidence: 1.4 })).toThrow();
  });

  it("emits a JSON schema the SDK can constrain output with", () => {
    expect(agentDecisionJsonSchema).toMatchObject({ type: "object" });
    expect(agentDecisionJsonSchema.required).toEqual(
      expect.arrayContaining(["recommendation", "confidence", "trace", "citedFacts"]),
    );
  });
});
