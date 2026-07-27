import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { TraceNode } from "@/modules/operators/types";

const RING = {
  not_met: "border-tx3",
  fired: "border-bad",
  cant_evaluate: "border-warn",
} as const;

const STATUS_COLOR = {
  not_met: "text-tx3",
  fired: "text-bad",
  cant_evaluate: "text-warn",
} as const;

const TL_STATUS = {
  not_met: "not met",
  fired: "▲ fired",
  cant_evaluate: "can't evaluate",
} as const;

export function TraceRow({ node }: { node: TraceNode }) {
  return (
    <div className="relative border-l-2 border-line pb-[18px] pl-[22px]">
      <div
        className={`absolute left-[-8px] top-0.5 h-[14px] w-[14px] rounded-full border-2 bg-bg ${RING[node.status]}`}
      />
      <div className="mb-2 flex items-baseline gap-2.5 font-mono text-[11.5px]">
        <PolicyLink line={node.src} />
        <span className={`text-[11px] ${STATUS_COLOR[node.status]}`}>
          {TL_STATUS[node.status]}
        </span>
      </div>
      <div className="flex gap-3 text-[13px] leading-[1.5]">
        <span className="w-[70px] flex-none font-normal text-tx3">RULE</span>
        <span className="text-tx">{node.rule}</span>
      </div>
      <div className="mt-1 flex gap-3 text-[13px] leading-[1.5]">
        <span className="w-[70px] flex-none font-normal text-tx3">EVIDENCE</span>
        <span className="text-tx">{node.evidence}</span>
      </div>
    </div>
  );
}
