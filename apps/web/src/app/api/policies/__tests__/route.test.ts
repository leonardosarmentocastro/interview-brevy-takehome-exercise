import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/policies/route";

describe("GET /api/policies", () => {
  it("returns policy text split into lines", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.lines)).toBe(true);
    expect(body.lines.length).toBeGreaterThan(10);
  });
});
