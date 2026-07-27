import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  captureAtom,
  captureLogAtom,
  decisionAtom,
  dialogAtom,
  openCaptureAtom,
  confirmCaptureAtom,
  resetDecisionAtom,
} from "@/modules/operators/data/atoms/capture";

describe("capture atoms", () => {
  it("opens a capture, then confirming logs it, records the decision, and closes", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Escalate to specialist", danger: true });
    expect(store.get(captureAtom)?.label).toBe("Escalate to specialist");
    store.set(confirmCaptureAtom, "Confirmed by operator per policy.");
    expect(store.get(captureAtom)).toBeNull();
    expect(store.get(captureLogAtom)).toHaveLength(1);
    expect(store.get(captureLogAtom)[0]).toMatch(/Escalate to specialist/);
    expect(store.get(decisionAtom)?.action.label).toBe("Escalate to specialist");
    expect(store.get(dialogAtom)).toMatch(/escalating to specialist's team board/i);
  });

  it("uses the destination table in the message for non-escalation moves", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Schedule 3rd retry", variant: "go" });
    store.set(confirmCaptureAtom, "budget allows a 4th attempt");
    expect(store.get(dialogAtom)).toMatch(/moving ticket to resolved/i);

    store.set(openCaptureAtom, { label: "Put on hold" });
    store.set(confirmCaptureAtom, "pending a ruling");
    expect(store.get(dialogAtom)).toMatch(/moving ticket to on hold/i);
  });

  it("reset clears capture, decision and dialog", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Put on hold" });
    store.set(confirmCaptureAtom, "x");
    store.set(resetDecisionAtom);
    expect(store.get(captureAtom)).toBeNull();
    expect(store.get(decisionAtom)).toBeNull();
    expect(store.get(dialogAtom)).toBeNull();
  });
});
