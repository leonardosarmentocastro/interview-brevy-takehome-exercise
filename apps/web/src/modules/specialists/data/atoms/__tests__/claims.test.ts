import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  claimedIdsAtom,
  claimAtom,
  deriveLanes,
} from "@/modules/specialists/data/atoms/claims";

describe("claims", () => {
  it("claiming removes from queue and prepends to investigating", () => {
    const store = createStore();
    store.set(claimAtom, "iss_087");
    expect(store.get(claimedIdsAtom).has("iss_087")).toBe(true);
    const queue = [{ id: "iss_087" }, { id: "iss_099" }] as never[];
    const investigating = [{ id: "iss_054" }] as never[];
    const lanes = deriveLanes(queue, investigating, store.get(claimedIdsAtom));
    expect(lanes.queue.map((c) => c.id)).toEqual(["iss_099"]);
    expect(lanes.investigating.map((c) => c.id)).toEqual([
      "iss_087",
      "iss_054",
    ]);
  });
});
