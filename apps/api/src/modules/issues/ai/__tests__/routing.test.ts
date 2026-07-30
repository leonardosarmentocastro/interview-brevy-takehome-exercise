import { describe, expect, it } from "vitest";
import { bandFor, route } from "@/modules/issues/ai/routing";

describe("bandFor", () => {
  it("auto-executes at and above 0.90", () => {
    expect(bandFor(0.9)).toBe("auto_execute");
    expect(bandFor(1)).toBe("auto_execute");
  });

  it("flags for async review from 0.70 to 0.89", () => {
    expect(bandFor(0.899)).toBe("execute_flagged");
    expect(bandFor(0.7)).toBe("execute_flagged");
  });

  it("requires a human decision below 0.70", () => {
    expect(bandFor(0.699)).toBe("human_decision");
    expect(bandFor(0)).toBe("human_decision");
  });
});

describe("route", () => {
  it("resolves a confident auto_resolve", () => {
    expect(route("auto_resolve", 0.95)).toEqual({
      band: "auto_execute",
      status: "resolved",
      decision: "resolve",
    });
  });

  it("escalates a confident escalate", () => {
    expect(route("escalate", 0.92)).toEqual({
      band: "auto_execute",
      status: "escalated",
      decision: "escalate",
    });
  });

  it("parks when the agent itself recommends a human", () => {
    // Executing "get a human" IS parking, so this is the recommendation
    // being carried out, not overridden.
    expect(route("human_review", 0.95)).toEqual({
      band: "auto_execute",
      status: "needs_review",
      decision: "defer",
    });
  });

  it("still executes in the flagged band", () => {
    expect(route("auto_resolve", 0.73)).toEqual({
      band: "execute_flagged",
      status: "resolved",
      decision: "resolve",
    });
  });

  it("takes no action below 0.70, whatever the recommendation", () => {
    // The recommendation survives for the human to read; only the authority
    // to act is withheld.
    expect(route("auto_resolve", 0.69)).toEqual({
      band: "human_decision",
      status: "needs_review",
      decision: "defer",
    });
  });
});
