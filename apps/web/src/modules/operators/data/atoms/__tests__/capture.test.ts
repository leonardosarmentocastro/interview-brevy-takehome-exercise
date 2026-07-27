import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  captureAtom,
  captureLogAtom,
  openCaptureAtom,
  confirmCaptureAtom,
} from "@/modules/operators/data/atoms/capture";

describe("capture atoms", () => {
  it("opens a capture, then confirming logs it and closes", () => {
    const store = createStore();
    store.set(openCaptureAtom, "Escalate to specialist");
    expect(store.get(captureAtom)?.actionLabel).toBe("Escalate to specialist");
    store.set(confirmCaptureAtom, "Confirmed by operator per policy.");
    expect(store.get(captureAtom)).toBeNull();
    expect(store.get(captureLogAtom)).toHaveLength(1);
    expect(store.get(captureLogAtom)[0]).toMatch(/Escalate to specialist/);
  });
});
