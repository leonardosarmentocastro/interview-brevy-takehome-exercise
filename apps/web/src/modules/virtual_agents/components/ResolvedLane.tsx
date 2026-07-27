"use client";

import Link from "next/link";
import type { ResolvedLane as ResolvedLaneData } from "@/modules/virtual_agents/types";

type ResolvedLaneProps = {
  resolved: ResolvedLaneData;
  onOpen?: (id: string) => void;
};

export function ResolvedLane({ resolved, onOpen }: ResolvedLaneProps) {
  return (
    <>
      <div className="done-tile">
        <div className="big" id="count-resolved-big">
          {resolved.count}
        </div>
        <div className="cap">resolved today with no human involved</div>
      </div>
      <div className="done-recent">
        <div className="rh">last 5 resolved — click to inspect reasoning</div>
        {resolved.recent.map((x) => (
          <button
            key={x.id}
            type="button"
            className="rrow"
            onClick={() => onOpen?.(x.id)}
          >
            <span className="rt">
              <b>{x.id}</b> · {x.typeShort}
            </span>
            <span className="chev">{x.note} ›</span>
          </button>
        ))}
      </div>
      <Link className="drill" href="/monitors/agents/drill">
        Drill into all {resolved.count} ▸
      </Link>
    </>
  );
}
