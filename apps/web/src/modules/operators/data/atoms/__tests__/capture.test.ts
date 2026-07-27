import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  captureAtom,
  captureLogAtom,
  pendingAtom,
  decisionAtom,
  openCaptureAtom,
  requestConfirmAtom,
  commitDecisionAtom,
  cancelConfirmAtom,
  resetDecisionAtom,
  confirmMessage,
} from "@/modules/operators/data/atoms/capture";

describe("capture atoms", () => {
  it("is a two-step commit: request stages a pending decision, commit logs and locks", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Put on hold" });

    store.set(requestConfirmAtom, "pending a ruling");
    // Step 1 stages but does not log or lock.
    expect(store.get(pendingAtom)?.action.label).toBe("Put on hold");
    expect(store.get(captureLogAtom)).toHaveLength(0);
    expect(store.get(decisionAtom)).toBeNull();

    store.set(commitDecisionAtom);
    // Step 2 logs, records the decision, and clears transient state.
    expect(store.get(captureLogAtom)).toHaveLength(1);
    expect(store.get(captureLogAtom)[0]).toMatch(/Put on hold/);
    expect(store.get(decisionAtom)?.action.label).toBe("Put on hold");
    expect(store.get(pendingAtom)).toBeNull();
    expect(store.get(captureAtom)).toBeNull();
  });

  it("cancel drops the pending decision without logging, keeping the option open", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Escalate to specialist", danger: true });
    store.set(requestConfirmAtom, "x");
    store.set(cancelConfirmAtom);
    expect(store.get(pendingAtom)).toBeNull();
    expect(store.get(captureAtom)?.label).toBe("Escalate to specialist");
    expect(store.get(captureLogAtom)).toHaveLength(0);
    expect(store.get(decisionAtom)).toBeNull();
  });

  it("builds the destination message per action", () => {
    expect(confirmMessage({ label: "Schedule 3rd retry", variant: "go" })).toMatch(
      /moving ticket to resolved/i,
    );
    expect(confirmMessage({ label: "Put on hold" })).toMatch(
      /moving ticket to on hold/i,
    );
    expect(
      confirmMessage({ label: "Escalate to specialist", danger: true }),
    ).toMatch(/escalating to specialist's team board/i);
  });

  it("reset clears capture, pending and decision", () => {
    const store = createStore();
    store.set(openCaptureAtom, { label: "Put on hold" });
    store.set(requestConfirmAtom, "x");
    store.set(commitDecisionAtom);
    store.set(resetDecisionAtom);
    expect(store.get(captureAtom)).toBeNull();
    expect(store.get(pendingAtom)).toBeNull();
    expect(store.get(decisionAtom)).toBeNull();
  });
});
