"use client";

import { useAtomValue, useSetAtom } from "jotai";
import type { Decision, DecisionAction } from "@/modules/operators/types";
import {
  captureAtom,
  decisionAtom,
  openCaptureAtom,
} from "@/modules/operators/data/atoms/capture";
import { CapturePanel } from "./CapturePanel";
import { DecisionDialog } from "./DecisionDialog";

const ABTN_BASE =
  "block w-full text-left mb-[9px] rounded-lg border px-3 py-2.5 font-semibold text-[13px] text-tx bg-col2 border-line cursor-pointer transition-colors hover:border-tx3";

function variantClasses(action: DecisionAction): string {
  if (action.danger || action.variant === "esc") {
    return "border-[rgba(248,81,73,0.5)] bg-[rgba(248,81,73,0.1)] text-bad hover:border-[rgba(248,81,73,0.7)]";
  }
  if (action.variant === "go") {
    return "border-[rgba(63,185,80,0.5)] bg-[rgba(63,185,80,0.1)] text-ok hover:border-[rgba(63,185,80,0.7)]";
  }
  return "";
}

function subClasses(action: DecisionAction): string {
  if (action.danger || action.variant === "esc") return "text-[rgba(248,81,73,0.7)]";
  if (action.variant === "go") return "text-[rgba(63,185,80,0.75)]";
  return "text-tx3";
}

const GRP =
  "mb-[9px] mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.5px] text-tx3";

export function DecisionRail({ decision }: { decision: Decision }) {
  const rec = decision.actions?.recommended;
  const others = decision.actions?.others ?? [];
  const activity = decision.activity ?? [];
  const openCapture = useSetAtom(openCaptureAtom);
  const capture = useAtomValue(captureAtom);
  const taken = useAtomValue(decisionAtom);

  // Escalate-to-specialist (the danger move) always reads last in the list.
  const orderedOthers = [...others].sort(
    (a, b) => Number(Boolean(a.danger)) - Number(Boolean(b.danger)),
  );

  const renderAction = (action: DecisionAction) => (
    <div key={action.label}>
      <button
        type="button"
        className={`${ABTN_BASE} ${variantClasses(action)}`}
        onClick={() => openCapture(action)}
      >
        {action.label}
        {action.sub ? (
          <span
            className={`mt-[3px] block font-mono text-[11px] font-normal ${subClasses(action)}`}
          >
            {action.sub}
          </span>
        ) : null}
      </button>
      {capture?.label === action.label ? <CapturePanel /> : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 border-t border-line bg-[#0b0e13] p-5 md:border-l md:border-t-0">
      <div className="overflow-hidden rounded-[10px] border border-line bg-col">
        <div className="border-b border-line px-[13px] py-[11px] font-mono text-[10.5px] uppercase tracking-[0.6px] text-tx3">
          Decision · what you do
        </div>
        <div className="p-[13px]">
          {taken ? (
            <>
              <div className={GRP}>Decision taken</div>
              <div
                className={`rounded-lg border px-3 py-2.5 ${variantClasses(taken.action) || "border-line bg-col2 text-tx"}`}
              >
                <div className="font-semibold text-[13px]">
                  ✓ {taken.action.label}
                </div>
                <div className="mt-1.5 text-[12px] leading-[1.45] text-tx2">
                  {taken.reason}
                </div>
              </div>
              <div className="mt-2.5 border-t border-dashed border-line pt-2.5 text-[11px] leading-[1.5] text-tx3">
                Logged — this panel is now read-only.
              </div>
            </>
          ) : (
            <>
              {rec ? (
                <>
                  <div className={GRP}>Recommended</div>
                  {renderAction(rec)}
                </>
              ) : (
                <div className={GRP}>No recommended action — your call</div>
              )}
              <div
                className={`${GRP} mt-3.5 border-t border-line pt-3`}
              >
                Other legal moves
              </div>
              {orderedOthers.map(renderAction)}
              <div className="mt-2.5 border-t border-dashed border-line pt-2.5 text-[11px] leading-[1.5] text-tx3">
                Every action writes an audit record —{" "}
                <b className="text-tx2">
                  who, when, action, reason, policy version
                </b>
                . policies.md:90
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h4 className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.6px] text-tx3">
          Activity
        </h4>
        <div className="flex flex-col gap-2.5">
          {activity.map((e) => (
            <div className="flex gap-2.5 text-[12.5px]" key={`${e.t}-${e.text}`}>
              <span className="min-w-[76px] flex-none font-mono text-[10.5px] text-tx3">
                {e.t}
              </span>
              <div className="text-tx2">
                <b className="text-tx">{e.text}</b>
                <br />
                <span className="font-mono text-[10.5px] text-tx3">{e.who}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DecisionDialog />
    </div>
  );
}
