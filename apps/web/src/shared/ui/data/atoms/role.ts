import { atom } from "jotai";
export type Role = "admin";
export const roleAtom = atom<Role | null>(null);
