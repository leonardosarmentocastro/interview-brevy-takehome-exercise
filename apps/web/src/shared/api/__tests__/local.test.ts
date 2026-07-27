import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLocal } from "@/shared/api/local";

afterEach(() => vi.restoreAllMocks());

describe("fetchLocal", () => {
  it("GETs a relative path and returns parsed JSON", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const data = await fetchLocal<{ ok: boolean }>("/api/policies");
    expect(spy).toHaveBeenCalledWith("/api/policies", expect.anything());
    expect(data).toEqual({ ok: true });
  });

  it("throws on non-ok responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    await expect(fetchLocal("/api/policies")).rejects.toThrow(/500/);
  });
});
