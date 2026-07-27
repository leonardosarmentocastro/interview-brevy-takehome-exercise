"use client";

import { useSetAtom } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { Decision } from "@/modules/operators/types";
import { openCaptureAtom } from "@/modules/operators/data/atoms/capture";
import { CapturePanel } from "./CapturePanel";
import "../style.css";

export function DecisionRail({ decision }: { decision: Decision }) {
  const why = decision.why;
  const rec = decision.actions?.recommended;
  const others = decision.actions?.others ?? [];
  const activity = decision.activity ?? [];
  const openCapture = useSetAtom(openCaptureAtom);

  return (
    <div className="rail">
      {why && (
        <div className={`rec ${why.face}`} style={{ marginBottom: 12 }}>
          <div className="lead">{why.lead}</div>
          <div className="bc">
            {why.because}
            {why.ref != null && (
              <>
                <br />
                <span className="ref">
                  See <PolicyLink line={why.ref} /> for reference
                </span>
              </>
            )}
          </div>
        </div>
      )}
      <div className="dpanel">
        <div className="h">Decision · what you do</div>
        <div className="body">
          {rec ? (
            <>
              <div className="grp">Recommended</div>
              <button
                type="button"
                className={`abtn rec-${rec.variant ?? "esc"}`}
                onClick={() => openCapture(rec.label)}
              >
                {rec.label}
                {rec.sub ? <span className="sub">{rec.sub}</span> : null}
              </button>
            </>
          ) : (
            <div className="grp">No recommended action — your call</div>
          )}
          <div className="grp second">Other legal moves</div>
          {others.map((a) => (
            <button
              key={a.label}
              type="button"
              className={`abtn${a.danger ? " danger" : ""}`}
              onClick={() => openCapture(a.label)}
            >
              {a.label}
              {a.sub ? <span className="sub">{a.sub}</span> : null}
            </button>
          ))}
          <CapturePanel />
          <div className="logged">
            Every action writes an audit record —{" "}
            <b>who, when, action, reason, policy version</b>. policies.md:90
          </div>
        </div>
      </div>
      <div className="sect">
        <h4 className="rail-h">Activity</h4>
        <div className="act">
          {activity.map((e) => (
            <div className="ev" key={`${e.t}-${e.text}`}>
              <span className="t">{e.t}</span>
              <div className="d">
                <b>{e.text}</b>
                <br />
                <span className="who">{e.who}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
