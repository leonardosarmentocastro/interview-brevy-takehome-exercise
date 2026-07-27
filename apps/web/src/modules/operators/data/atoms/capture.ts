import { atom } from "jotai";
import type { DecisionAction } from "@/modules/operators/types";

// The option currently expanded for confirmation (null = none expanded).
export const captureAtom = atom<DecisionAction | null>(null);
// Append-only audit trail of confirmed decisions.
export const captureLogAtom = atom<string[]>([]);
// Step 1 → the decision awaiting a final confirmation in the dialog.
export const pendingAtom = atom<{ action: DecisionAction; reason: string } | null>(
  null,
);
// Step 2 → the committed decision; locks the panel read-only once set.
export const decisionAtom = atom<{ action: DecisionAction; reason: string } | null>(
  null,
);

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

// Step 1: the inline "Confirm" button asks for a final confirmation (opens the
// dialog). Nothing is logged or locked yet.
export const requestConfirmAtom = atom(null, (get, set, reason: string) => {
  const action = get(captureAtom);
  if (!action) return;
  set(pendingAtom, { action, reason });
});

// Step 2: the dialog's confirm commits the decision — logs it and locks the panel.
export const commitDecisionAtom = atom(null, (get, set) => {
  const pending = get(pendingAtom);
  if (!pending) return;
  set(captureLogAtom, [
    ...get(captureLogAtom),
    `${pending.action.label} — ${pending.reason}`,
  ]);
  set(decisionAtom, pending);
  set(pendingAtom, null);
  set(captureAtom, null);
});

// The dialog's cancel drops the pending decision but keeps the option expanded
// so the operator can adjust the reason and try again.
export const cancelConfirmAtom = atom(null, (_get, set) =>
  set(pendingAtom, null),
);

// Clears all decision state — call when the detail view switches tickets.
export const resetDecisionAtom = atom(null, (_get, set) => {
  set(captureAtom, null);
  set(pendingAtom, null);
  set(decisionAtom, null);
});
