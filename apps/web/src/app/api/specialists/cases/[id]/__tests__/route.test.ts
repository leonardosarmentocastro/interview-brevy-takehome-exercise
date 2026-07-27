import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/specialists/cases/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/specialists/cases/[id]", () => {
  it("returns iss_003", async () => {
    const res = await GET(new Request("http://x"), ctx("iss_003"));
    const body = await res.json();
    expect(body.id).toBe("iss_003");
    expect(body.history?.length).toBeGreaterThan(0);
  });

  it("404s for an unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
