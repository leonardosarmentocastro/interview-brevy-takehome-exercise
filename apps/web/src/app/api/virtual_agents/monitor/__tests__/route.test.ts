import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/virtual_agents/monitor/route";

describe("GET /api/virtual_agents/monitor", () => {
  it("returns the monitor snapshot", async () => {
    const body = await (await GET()).json();
    expect(body.stats).toBeDefined();
    expect(Array.isArray(body.log)).toBe(true);
    expect(Array.isArray(body.simPool)).toBe(true);
  });
});
