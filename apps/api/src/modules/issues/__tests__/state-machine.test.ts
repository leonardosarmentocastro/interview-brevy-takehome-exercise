import { describe, expect, it } from "vitest";
import { nextStatusFor } from "@/modules/issues/state-machine";
import type { IssueStatus } from "@/modules/issues/types";

describe("nextStatusFor", () => {
  it("resolve -> resolved from processing, on_hold, escalated", () => {
    expect(nextStatusFor("processing", "resolve")).toBe("resolved");
    expect(nextStatusFor("on_hold", "resolve")).toBe("resolved");
    expect(nextStatusFor("escalated", "resolve")).toBe("resolved");
  });

  it("escalate -> escalated from processing, on_hold", () => {
    expect(nextStatusFor("processing", "escalate")).toBe("escalated");
    expect(nextStatusFor("on_hold", "escalate")).toBe("escalated");
  });

  it("hold -> on_hold from processing, escalated", () => {
    expect(nextStatusFor("processing", "hold")).toBe("on_hold");
    expect(nextStatusFor("escalated", "hold")).toBe("on_hold");
  });

  it("returns null for illegal transitions", () => {
    // pending is never reviewable
    expect(nextStatusFor("pending", "resolve")).toBeNull();
    expect(nextStatusFor("pending", "escalate")).toBeNull();
    expect(nextStatusFor("pending", "hold")).toBeNull();
    // resolved is terminal
    expect(nextStatusFor("resolved", "resolve")).toBeNull();
    // no double-apply
    expect(nextStatusFor("escalated", "escalate")).toBeNull();
    expect(nextStatusFor("on_hold", "hold")).toBeNull();
  });

  // Guards against forgetting a status in the "from" lists.
  it("only legal (status, decision) pairs are non-null", () => {
    const statuses: IssueStatus[] = [
      "pending",
      "processing",
      "on_hold",
      "resolved",
      "escalated",
    ];
    const legal = new Set([
      "processing:resolve",
      "on_hold:resolve",
      "escalated:resolve",
      "processing:escalate",
      "on_hold:escalate",
      "processing:hold",
      "escalated:hold",
    ]);
    for (const s of statuses) {
      for (const d of ["resolve", "escalate", "hold"] as const) {
        const expected = legal.has(`${s}:${d}`);
        expect(nextStatusFor(s, d) !== null).toBe(expected);
      }
    }
  });
});
