import { atom } from "jotai";
import type { DecisionAction } from "@/modules/operators/types";

// The option currently expanded for confirmation (null = none expanded).
export const captureAtom = atom<DecisionAction | null>(null);
// Append-only audit trail of confirmed decisions.
export const captureLogAtom = atom<string[]>([]);
// The decision the operator committed to; locks the panel read-only once set.
export const decisionAtom = atom<{ action: DecisionAction; reason: string } | null>(
  null,
);
// Acknowledgement dialog message (null = closed).
export const dialogAtom = atom<string | null>(null);

export const openCaptureAtom = atom(
  null,
  (_get, set, action: DecisionAction) => set(captureAtom, action),
);

export function confirmMessage(action: DecisionAction): string {
  if (action.danger || action.variant === "esc") {
    return "Decision confirmed and logged, moving ticket out of your board and escalating to specialist's team board.";
  }
  const table = action.variant === "go" ? "resolved" : "on hold";
  return `Decision confirmed and logged, moving ticket to ${table}.`;
}

export const confirmCaptureAtom = atom(null, (get, set, reason: string) => {
  const action = get(captureAtom);
  if (!action) return;
  set(captureLogAtom, [...get(captureLogAtom), `${action.label} — ${reason}`]);
  set(decisionAtom, { action, reason });
  set(dialogAtom, confirmMessage(action));
  set(captureAtom, null);
});

export const closeDialogAtom = atom(null, (_get, set) => set(dialogAtom, null));

// Clears all decision state — call when the detail view switches tickets.
export const resetDecisionAtom = atom(null, (_get, set) => {
  set(captureAtom, null);
  set(decisionAtom, null);
  set(dialogAtom, null);
});
