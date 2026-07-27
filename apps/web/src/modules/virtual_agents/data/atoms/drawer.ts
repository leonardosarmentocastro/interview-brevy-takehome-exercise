import { atom } from "jotai";

export type DrawerState = {
  kind: "intake" | "resolved";
  id: string;
};

export const drawerAtom = atom<DrawerState | null>(null);

export const openDrawerAtom = atom(
  null,
  (_get, set, next: DrawerState) => set(drawerAtom, next),
);

export const closeDrawerAtom = atom(null, (_get, set) => set(drawerAtom, null));
