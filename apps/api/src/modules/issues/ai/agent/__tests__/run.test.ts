import { describe, expect, it } from "vitest";
import { parseAgentResult } from "@/modules/issues/ai/agent/run";

const valid = {
  recommendation: "auto_resolve",
  confidence: 0.95,
  reasoning: "Within the window and unshipped.",
  trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
  citedFacts: [],
  dataGap: null,
};

describe("parseAgentResult", () => {
  it("accepts an already-parsed object", () => {
    expect(parseAgentResult(valid)).toMatchObject({ recommendation: "auto_resolve" });
  });

  it("accepts a JSON string", () => {
    expect(parseAgentResult(JSON.stringify(valid))).toMatchObject({ confidence: 0.95 });
  });

  it("tolerates a fenced code block around the JSON", () => {
    // Belt and braces: outputFormat should prevent this, but a malformed
    // wrapper must not be the difference between a decision and an outage.
    expect(
      parseAgentResult("```json\n" + JSON.stringify(valid) + "\n```"),
    ).toMatchObject({ confidence: 0.95 });
  });

  it("throws on output that does not match the schema", () => {
    expect(() => parseAgentResult({ recommendation: "refund_everything" })).toThrow();
  });

  it("throws on unparseable output", () => {
    expect(() => parseAgentResult("not json at all")).toThrow();
  });

  it("throws when the result is absent", () => {
    expect(() => parseAgentResult(undefined)).toThrow();
  });
});
