import { describe, expect, it } from "vitest";
import { filterCards } from "@/modules/specialists/data/atoms/filter";

const cards = [
  { id: "iss_004", cat: "fraud", meta: "iss_004 morgan homeessentials" },
  { id: "iss_060", cat: "dispute", meta: "iss_060 dana techgadgets" },
] as never[];

describe("filterCards", () => {
  it("filters by category and query", () => {
    expect(filterCards(cards, "fraud", "").map((c) => c.id)).toEqual([
      "iss_004",
    ]);
    expect(filterCards(cards, "all", "dana").map((c) => c.id)).toEqual([
      "iss_060",
    ]);
  });
});
