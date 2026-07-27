"use client";

import type { ReactNode } from "react";
import type {
  MonitorSnapshot,
  IntakeItem,
  SimTicket,
  WaitItem,
} from "@/modules/virtual_agents/types";
import { IntakeCard } from "./IntakeCard";
import { WaitCard } from "./WaitCard";
import { ResolvedLane } from "./ResolvedLane";
import "../style.css";

type PipelineColumnsProps = {
  snapshot: MonitorSnapshot;
  intake?: Array<IntakeItem | SimTicket>;
  waiting?: WaitItem[];
  resolvedCount?: number;
  simulatorSlot?: ReactNode;
  onOpenIntake?: (id: string) => void;
  onOpenResolved?: (id: string) => void;
};

export function PipelineColumns({
  snapshot,
  intake = snapshot.intake,
  waiting = snapshot.waiting,
  resolvedCount = snapshot.resolved.count,
  simulatorSlot,
  onOpenIntake,
  onOpenResolved,
}: PipelineColumnsProps) {
  const waitTotal = waiting.length + (snapshot.waitingMore || 0);
  const resolved = { ...snapshot.resolved, count: resolvedCount };

  return (
    <div className="pipe">
      <div className="lane intake">
        <div className="lane-h">
          <h3>Intake · unprocessed</h3>
          <span className="n" id="count-intake">
            {intake.length}
          </span>
        </div>
        <p className="lane-note">
          The mouth of the pipe — tickets that arrived from the vendor feed and
          haven&apos;t been evaluated yet. Near-zero in steady state; fills on
          bursts.
        </p>
        {simulatorSlot}
        <div id="intake-cards">
          {intake.map((it) => (
            <IntakeCard key={it.id} item={it} onOpen={onOpenIntake} />
          ))}
        </div>
      </div>
      <div className="arrowcol">⟶</div>
      <div className="lane wait">
        <div className="lane-h">
          <h3>Waiting · system-managed</h3>
          <span className="n" id="count-waiting">
            {waitTotal}
          </span>
        </div>
        <p className="lane-note">
          The machine is holding these automatically — a timer, a customer
          nudge, or a grace clock. No human owns them yet. Each card says
          exactly what it&apos;s blocked on.
        </p>
        <div id="wait-cards">
          {waiting.map((it) => (
            <WaitCard key={it.id} item={it} />
          ))}
        </div>
        {snapshot.waitingMore ? (
          <div className="intake-empty" style={{ marginTop: 2 }}>
            + {snapshot.waitingMore} more waiting
          </div>
        ) : null}
      </div>
      <div className="arrowcol">⟶</div>
      <div className="lane done">
        <div className="lane-h">
          <h3>Resolved · automatically</h3>
          <span className="n" id="count-resolved">
            {resolved.count}
          </span>
        </div>
        <p className="lane-note">
          The bulk of traffic. Never a wall of cards — a rolling count you drill
          into. Click any recent ticket to see the agent&apos;s reasoning.
        </p>
        <ResolvedLane resolved={resolved} onOpen={onOpenResolved} />
      </div>
    </div>
  );
}
