import type { TraceNode } from "@/modules/operators/types";
import { TraceRow } from "./TraceRow";
import "../style.css";

export function Timeline({ trace }: { trace?: TraceNode[] }) {
  const nodes = trace ?? [];
  return (
    <div className="tl">
      {nodes.map((node) => (
        <TraceRow key={`${node.src}-${node.status}-${node.rule}`} node={node} />
      ))}
      <div className="step end">
        <div className="dot" />
        <div className="concl">→ conclusion below</div>
      </div>
    </div>
  );
}
