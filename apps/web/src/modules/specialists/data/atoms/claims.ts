import { atom } from "jotai";
import type { SpecialistCard } from "@/modules/specialists/types";

export const claimedIdsAtom = atom<Set<string>>(new Set());

export const claimAtom = atom(null, (get, set, id: string) => {
  const next = new Set(get(claimedIdsAtom));
  next.add(id);
  set(claimedIdsAtom, next);
});

export function deriveLanes(
  queue: SpecialistCard[],
  investigating: SpecialistCard[],
  claimed: Set<string>,
): { queue: SpecialistCard[]; investigating: SpecialistCard[] } {
  const moved = queue
    .filter((c) => claimed.has(c.id))
    .map((c) => ({ ...c, claimed: true, owner: c.owner ?? "you" }));
  return {
    queue: queue.filter((c) => !claimed.has(c.id)),
    investigating: [...moved, ...investigating],
  };
}
