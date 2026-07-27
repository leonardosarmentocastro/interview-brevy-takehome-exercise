import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/specialists/board/route";

describe("GET /api/specialists/board", () => {
  it("returns queue + mine snapshot", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.queue?.length).toBeGreaterThan(0);
    expect(body.mine).toBeDefined();
    expect(body.mine.investigating).toBeDefined();
    expect(body.online).toBe(3);
  });
});
