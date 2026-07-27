import { describe, expect, it } from "vitest";
import { filterRows } from "@/modules/virtual_agents/data/atoms/drill-filter";

const rows = [
  { id: "iss_004", cat: "refund", txt: "iss_004 morgan homeessentials" },
  { id: "iss_060", cat: "decline", txt: "iss_060 dana techgadgets" },
] as never[];

describe("filterRows", () => {
  it("filters by category and query", () => {
    expect(
      filterRows(rows, "refund", "").map((r: never) => (r as { id: string }).id),
    ).toEqual(["iss_004"]);
    expect(
      filterRows(rows, "all", "dana").map((r: never) => (r as { id: string }).id),
    ).toEqual(["iss_060"]);
  });
});
