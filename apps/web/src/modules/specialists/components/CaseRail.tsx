"use client";

import { useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { SpecialistCase } from "@/modules/specialists/types";
import {
  confirmSpecCaptureAtom,
  openSpecCaptureAtom,
  specCaptureAtom,
} from "@/modules/specialists/data/atoms/capture";
import "../style.css";

const DEFAULT_REASON = "Confirmed by specialist per policy.";

function SpecCapturePanel() {
  const capture = useAtomValue(specCaptureAtom);
  const confirm = useSetAtom(confirmSpecCaptureAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!capture) return null;

  return (
    <div className="capture">
      <div className="cl-h">
        {capture.actionLabel} — confirm &amp; log
      </div>
      <div className="fld">
        <label htmlFor="spec-capture-reason">
          Reason (pre-filled from policy)
        </label>
        <textarea
          id="spec-capture-reason"
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

export function CaseRail({ case: c }: { case: SpecialistCase }) {
  const openCapture = useSetAtom(openSpecCaptureAtom);

  return (
    <div className="rail">
      <div className="dpanel">
        <div className="h">Terminal decision</div>
        <div className="body">
          <div className="grp">Resolve</div>
          {c.rail.resolve.map((b) => {
            const cls =
              b.variant === "esc"
                ? "abtn rec-esc"
                : b.variant === "go"
                  ? "abtn rec-go"
                  : "abtn";
            return (
              <button
                key={b.label}
                type="button"
                className={cls}
                onClick={() => openCapture(b.label)}
              >
                {b.label}
                <span className="sub">{b.sub}</span>
              </button>
            );
          })}
          <div className="grp second">Other moves</div>
          {c.rail.other.map((b) => (
            <button
              key={b.label}
              type="button"
              className="abtn"
              onClick={() => openCapture(b.label)}
            >
              {b.label}
              <span className="sub">{b.sub}</span>
            </button>
          ))}
          <SpecCapturePanel />
          <div className="logged">
            <b>Writes to the audit log:</b> who (Sam), when, action, reason,
            policy version. Every terminal action captures a reason before it
            commits (<PolicyLink line={90} />).
          </div>
        </div>
      </div>
      <div className="terminal-note">{c.terminalNote}</div>
    </div>
  );
}
