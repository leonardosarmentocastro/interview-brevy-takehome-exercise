"use client";

import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { DecisionAction } from "@/modules/operators/types";
import {
  captureAtom,
  confirmCaptureAtom,
} from "@/modules/operators/data/atoms/capture";

const DEFAULT_REASON = "Confirmed by operator per policy.";

type Theme = { box: string; head: string; btn: string };

const THEMES: Record<"go" | "esc" | "dark", Theme> = {
  go: {
    box: "border-[rgba(63,185,80,0.45)] bg-[rgba(63,185,80,0.05)]",
    head: "text-ok",
    btn: "border-[rgba(63,185,80,0.6)] bg-[rgba(63,185,80,0.15)] text-ok",
  },
  esc: {
    box: "border-[rgba(248,81,73,0.45)] bg-[rgba(248,81,73,0.05)]",
    head: "text-bad",
    btn: "border-[rgba(248,81,73,0.6)] bg-[rgba(248,81,73,0.15)] text-bad",
  },
  dark: {
    box: "border-line bg-col2",
    head: "text-tx2",
    btn: "border-line bg-bg text-tx2 hover:border-tx3 hover:text-tx",
  },
};

function themeFor(action: DecisionAction): Theme {
  if (action.danger || action.variant === "esc") return THEMES.esc;
  if (action.variant === "go") return THEMES.go;
  return THEMES.dark;
}

export function CapturePanel() {
  const action = useAtomValue(captureAtom);
  const confirm = useSetAtom(confirmCaptureAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!action) return null;

  const theme = themeFor(action);

  return (
    <div
      className={`mx-0 mb-[9px] mt-0.5 rounded-lg border border-dashed p-3 ${theme.box}`}
    >
      <div
        className={`mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.4px] ${theme.head}`}
      >
        {action.label} — confirm &amp; log
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
          className={`cursor-pointer rounded-[7px] border px-4 py-[9px] text-[12.5px] font-semibold ${theme.btn}`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
