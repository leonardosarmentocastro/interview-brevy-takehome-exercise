import { atom } from "jotai";
import type { DrillRow } from "@/modules/virtual_agents/types";

export const drillCatAtom = atom("all");
export const drillQueryAtom = atom("");

export function filterRows(
  rows: DrillRow[],
  cat: string,
  query: string,
): DrillRow[] {
  const q = query.toLowerCase().trim();
  return rows.filter((r) => {
    const okCat = cat === "all" || r.cat === cat;
    const okQ = !q || r.txt.includes(q);
    return okCat && okQ;
  });
}
