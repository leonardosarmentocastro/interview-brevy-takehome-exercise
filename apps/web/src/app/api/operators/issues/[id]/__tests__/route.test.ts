import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/operators/issues/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/operators/issues/[id]", () => {
  it("returns the matching view model", async () => {
    const res = await GET(new Request("http://x"), ctx("iss_003"));
    const vm = await res.json();
    expect(vm.issue.id).toBe("iss_003");
  });
  it("404s for an unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
