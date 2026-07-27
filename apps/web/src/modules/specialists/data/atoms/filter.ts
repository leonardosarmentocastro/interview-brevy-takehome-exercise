import { atom } from "jotai";
import type { SpecialistCard } from "@/modules/specialists/types";

export const specCatAtom = atom("all");
export const specQueryAtom = atom("");

export function filterCards(
  cards: SpecialistCard[],
  cat: string,
  query: string,
): SpecialistCard[] {
  const q = query.toLowerCase().trim();
  return cards.filter((c) => {
    const okCat = cat === "all" || c.cat === cat;
    const okQ = !q || `${c.id} ${c.meta}`.toLowerCase().includes(q);
    return okCat && okQ;
  });
}
