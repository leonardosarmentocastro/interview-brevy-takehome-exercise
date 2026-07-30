import { describe, expect, it } from "vitest";
import { hasLeftTheQueue } from "@/modules/issues/lifecycle";

describe("hasLeftTheQueue", () => {
  it("is false while the issue is still the queue's responsibility", () => {
    expect(hasLeftTheQueue("pending")).toBe(false);
    expect(hasLeftTheQueue("processing")).toBe(false);
  });

  it("is true once a human owns the issue", () => {
    expect(hasLeftTheQueue("needs_review")).toBe(true);
    expect(hasLeftTheQueue("on_hold")).toBe(true);
    expect(hasLeftTheQueue("resolved")).toBe(true);
    expect(hasLeftTheQueue("escalated")).toBe(true);
  });
});
