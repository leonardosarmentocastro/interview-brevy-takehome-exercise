"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { closeDialogAtom, dialogAtom } from "@/modules/operators/data/atoms/capture";

export function DecisionDialog() {
  const message = useAtomValue(dialogAtom);
  const close = useSetAtom(closeDialogAtom);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60"
        data-testid="dialog-backdrop"
        onClick={close}
      />
      <div className="relative w-[min(440px,92vw)] rounded-xl border border-line bg-col p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.5px] text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Decision logged
        </div>
        <p className="text-[13.5px] leading-[1.55] text-tx2">{message}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-[7px] border border-line bg-col2 px-4 py-2 text-[12.5px] font-semibold text-tx2 transition-colors hover:border-tx3 hover:text-tx"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
