"use client";

import { useSetAtom } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { AnalysisRecord } from "@/modules/virtual_agents/types";
import { closeDrawerAtom } from "@/modules/virtual_agents/data/atoms/drawer";
import "../style.css";

export function ResolvedDrawer({ analysis }: { analysis: AnalysisRecord }) {
  const close = useSetAtom(closeDrawerAtom);
  return (
    <div className="drawerwrap open">
      <div
        className="drawerbg"
        data-testid="drawer-backdrop"
        onClick={() => close()}
      />
      <div className="drawer">
        <div className="dh">
          <span className="ids">
            {analysis.id} · {analysis.txnId}
          </span>
          <button type="button" className="close" onClick={() => close()}>
            ✕
          </button>
        </div>
        <span className="dpill done">
          Resolved automatically · {analysis.resolvedAt}
        </span>
        <div className="dtype">
          <span className="ty">{analysis.type}</span>
          <span className="am">{analysis.amountText}</span>
        </div>
        <div className="dsec">What the agent decided</div>
        <div className="rec">
          <div className="lead">{analysis.rec.lead}</div>
          <div className="bc">
            {/* Fixtures are trusted authored HTML (may contain <b>). */}
            <span dangerouslySetInnerHTML={{ __html: analysis.rec.because }} />{" "}
            See <PolicyLink line={analysis.rec.ref} />.
          </div>
        </div>
        <div className="dsec">How it got there</div>
        <div className="tl">
          {analysis.trace.map((c) => (
            <div key={`${c.src}-${c.rule}`} className="step">
              <div className="dot" />
              <div className="shead">
                <PolicyLink line={c.src} />
                <span className="st">✓ {c.status}</span>
              </div>
              <div className="ln">
                <span className="pfx">RULE</span>
                <span className="val">{c.rule}</span>
              </div>
              <div className="ln">
                <span className="pfx">EVIDENCE</span>
                <span className="val">{c.evidence}</span>
              </div>
            </div>
          ))}
          <div className="step end">
            <div className="dot" />
            <div className="concl">{analysis.conclusion}</div>
          </div>
        </div>
        <div className="dsec">Context</div>
        <table className="dtable">
          <tbody>
            {analysis.context.map(([k, v]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dfoot">
          Logged automatically —{" "}
          {/* Fixtures are trusted authored HTML (may contain <b>). */}
          <span dangerouslySetInnerHTML={{ __html: analysis.audit }} />
        </div>
      </div>
    </div>
  );
}
