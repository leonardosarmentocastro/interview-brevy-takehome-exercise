import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/operators/issues/route";

describe("GET /api/operators/issues", () => {
  it("returns view models grouped into four columns plus agent summary", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body.columns).sort()).toEqual([
      "in_review",
      "needs_review",
      "on_hold",
      "resolved",
    ]);
    expect(body.agentSummary).toBeDefined();
  });
});
