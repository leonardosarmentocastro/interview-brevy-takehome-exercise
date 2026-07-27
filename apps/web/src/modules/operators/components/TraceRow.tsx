import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { TraceNode } from "@/modules/operators/types";

const TL_CLASS = {
  not_met: "n",
  fired: "f",
  cant_evaluate: "m",
} as const;

const TL_STATUS = {
  not_met: "not met",
  fired: "▲ fired",
  cant_evaluate: "can't evaluate",
} as const;

export function TraceRow({ node }: { node: TraceNode }) {
  return (
    <div className={`step ${TL_CLASS[node.status]}`}>
      <div className="dot" />
      <div className="shead">
        <PolicyLink line={node.src} />
        <span className="st">{TL_STATUS[node.status]}</span>
      </div>
      <div className="ln">
        <span className="pfx">RULE</span>
        <span className="val">{node.rule}</span>
      </div>
      <div className="ln">
        <span className="pfx">EVIDENCE</span>
        <span className="val">{node.evidence}</span>
      </div>
    </div>
  );
}
