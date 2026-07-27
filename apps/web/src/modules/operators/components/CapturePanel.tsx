"use client";

import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  captureAtom,
  confirmCaptureAtom,
} from "@/modules/operators/data/atoms/capture";
import "../style.css";

const DEFAULT_REASON = "Confirmed by operator per policy.";

export function CapturePanel() {
  const capture = useAtomValue(captureAtom);
  const confirm = useSetAtom(confirmCaptureAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!capture) return null;

  return (
    <div className="capture">
      <div className="cl-h">
        {capture.actionLabel} — confirm &amp; log
      </div>
      <div className="fld">
        <label htmlFor="capture-reason">Reason (pre-filled from policy)</label>
        <textarea
          id="capture-reason"
          ref={textareaRef}
          defaultValue={DEFAULT_REASON}
        />
      </div>
      <div className="capfoot">
        <button
          type="button"
          className="capbtn go"
          onClick={() =>
            confirm(textareaRef.current?.value ?? DEFAULT_REASON)
          }
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
