"use client";

import { useAtomValue, useSetAtom } from "jotai";
import {
  cancelConfirmAtom,
  commitDecisionAtom,
  confirmMessage,
  pendingAtom,
} from "@/modules/operators/data/atoms/capture";

const PRIMARY_BTN: Record<"go" | "esc" | "neutral", string> = {
  go: "border-[rgba(63,185,80,0.6)] bg-[rgba(63,185,80,0.15)] text-ok",
  esc: "border-[rgba(248,81,73,0.6)] bg-[rgba(248,81,73,0.15)] text-bad",
  neutral: "border-line bg-col2 text-tx hover:border-tx3",
};

export function DecisionDialog() {
  const pending = useAtomValue(pendingAtom);
  const commit = useSetAtom(commitDecisionAtom);
  const cancel = useSetAtom(cancelConfirmAtom);

  if (!pending) return null;

  const action = pending.action;
  const tone =
    action.danger || action.variant === "esc"
      ? "esc"
      : action.variant === "go"
        ? "go"
        : "neutral";

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60"
        data-testid="dialog-backdrop"
        onClick={() => cancel()}
      />
      <div className="relative w-[min(460px,92vw)] rounded-xl border border-line bg-col p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.5px] text-tx3">
          Confirm decision
        </div>
        <p className="text-[13.5px] leading-[1.55] text-tx2">
          {confirmMessage(action)}
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => cancel()}
            className="cursor-pointer rounded-[7px] border border-line bg-transparent px-4 py-2 text-[12.5px] font-semibold text-tx3 transition-colors hover:border-tx3 hover:text-tx2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => commit()}
            className={`cursor-pointer rounded-[7px] border px-4 py-2 text-[12.5px] font-semibold transition-colors ${PRIMARY_BTN[tone]}`}
          >
            Confirm decision
          </button>
        </div>
      </div>
    </div>
  );
}
