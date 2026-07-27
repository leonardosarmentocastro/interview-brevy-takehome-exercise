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
        <div className="mb-1.5 rounded-[10px] border border-ok/32 bg-ok/8 px-[14px] py-3">
          <div className="font-mono text-[13px] font-bold tracking-[0.2px] text-ok">
            {analysis.rec.lead}
          </div>
          <div className="mt-[7px] text-[13px] leading-normal text-tx2 [&_b]:text-tx">
            {/* Fixtures are trusted authored HTML (may contain <b>). */}
            <span dangerouslySetInnerHTML={{ __html: analysis.rec.because }} />{" "}
            See <PolicyLink line={analysis.rec.ref} />.
          </div>
        </div>
        <div className="dsec">How it got there</div>
        <div className="ml-1.5 mt-1.5">
          {analysis.trace.map((c) => (
            <div
              key={`${c.src}-${c.rule}`}
              className="relative border-l-2 border-line pb-4 pl-[22px] last:border-l-transparent last:pb-0"
            >
              <div className="absolute -left-2 top-0.5 h-[14px] w-[14px] rounded-full border-2 border-ok bg-bg" />
              <div className="mb-[7px] flex items-baseline gap-2.5">
                <PolicyLink line={c.src} />
                <span className="font-mono text-[11px] text-ok">
                  ✓ {c.status}
                </span>
              </div>
              <div className="flex gap-3 text-[12.5px] leading-normal">
                <span className="w-[66px] shrink-0 text-tx3">RULE</span>
                <span className="text-tx">{c.rule}</span>
              </div>
              <div className="mt-1 flex gap-3 text-[12.5px] leading-normal">
                <span className="w-[66px] shrink-0 text-tx3">EVIDENCE</span>
                <span className="text-tx">{c.evidence}</span>
              </div>
            </div>
          ))}
          <div className="relative border-l-2 border-transparent pl-[22px]">
            <div className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 border-ok bg-ok" />
            <div className="text-[13.5px] font-semibold text-ok">
              {analysis.conclusion}
            </div>
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
