"use client";

import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  captureAtom,
  confirmCaptureAtom,
} from "@/modules/operators/data/atoms/capture";

const DEFAULT_REASON = "Confirmed by operator per policy.";

export function CapturePanel() {
  const capture = useAtomValue(captureAtom);
  const confirm = useSetAtom(confirmCaptureAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!capture) return null;

  return (
    <div className="mx-0 mb-[9px] mt-0.5 rounded-lg border border-dashed border-[rgba(63,185,80,0.45)] bg-[rgba(63,185,80,0.05)] p-3">
      <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ok">
        {capture.actionLabel} — confirm &amp; log
      </div>
      <div className="mb-2.5">
        <label
          htmlFor="capture-reason"
          className="mb-1 block font-mono text-[10.5px] tracking-[0.3px] text-tx3"
        >
          Reason (pre-filled from policy)
        </label>
        <textarea
          id="capture-reason"
          ref={textareaRef}
          defaultValue={DEFAULT_REASON}
          className="min-h-[52px] w-full resize-y rounded-md border border-line bg-bg px-[9px] py-[7px] text-[12.5px] text-tx"
        />
      </div>
      <div className="mt-0.5 flex justify-end">
        <button
          type="button"
          onClick={() => confirm(textareaRef.current?.value ?? DEFAULT_REASON)}
          className="cursor-pointer rounded-[7px] border border-[rgba(63,185,80,0.6)] bg-[rgba(63,185,80,0.15)] px-4 py-[9px] text-[12.5px] font-semibold text-ok"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
