import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  drawerAtom,
  openDrawerAtom,
  closeDrawerAtom,
} from "@/modules/virtual_agents/data/atoms/drawer";

describe("drawer atom", () => {
  it("opens and closes", () => {
    const s = createStore();
    s.set(openDrawerAtom, { kind: "intake", id: "iss_061" });
    expect(s.get(drawerAtom)).toEqual({ kind: "intake", id: "iss_061" });
    s.set(closeDrawerAtom);
    expect(s.get(drawerAtom)).toBeNull();
  });
});
