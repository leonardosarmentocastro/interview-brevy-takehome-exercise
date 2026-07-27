import type { TraceNode } from "@/modules/operators/types";
import { TraceRow } from "./TraceRow";

export function Timeline({ trace }: { trace?: TraceNode[] }) {
  const nodes = trace ?? [];
  return (
    <div className="ml-1.5">
      {nodes.map((node) => (
        <TraceRow key={`${node.src}-${node.status}-${node.rule}`} node={node} />
      ))}
      <div className="relative border-l-2 border-transparent pl-[22px]">
        <div className="absolute left-[-9px] top-0.5 h-4 w-4 rounded-full border-2 border-warn bg-warn" />
        <div className="text-[14px] font-semibold text-warn">
          → conclusion below
        </div>
      </div>
    </div>
  );
}
