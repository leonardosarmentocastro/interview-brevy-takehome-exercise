"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useMonitor } from "@/modules/virtual_agents/hooks/use-monitor";
import { StatStrip } from "@/modules/virtual_agents/components/StatStrip";
import { AgentLog } from "@/modules/virtual_agents/components/AgentLog";
import { PipelineColumns } from "@/modules/virtual_agents/components/PipelineColumns";
import { SimulatorControls } from "@/modules/virtual_agents/components/SimulatorControls";
import {
  simInitAtom,
  intakeQueueAtom,
  waitingAtom,
  resolvedCountAtom,
  logAtom,
  statsAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";
import "../style.css";

export function MonitorPage({ autoRun = true }: { autoRun?: boolean }) {
  const { data, isLoading } = useMonitor();
  const init = useSetAtom(simInitAtom);
  const [seeded, setSeeded] = useState(false);

  const intake = useAtomValue(intakeQueueAtom);
  const waiting = useAtomValue(waitingAtom);
  const resolvedCount = useAtomValue(resolvedCountAtom);
  const log = useAtomValue(logAtom);
  const stats = useAtomValue(statsAtom);

  useEffect(() => {
    if (!data || seeded) return;
    init(data);
    setSeeded(true);
  }, [data, init, seeded]);

  if (isLoading || !data) {
    return <main data-testid="screen-monitor">Loading…</main>;
  }

  return (
    <main data-testid="screen-monitor">
      <div className="mhead">
        <span className="ico">◆</span>
        <h1>Virtual agent — pipeline monitor</h1>
        <span className="tag">machine · read-only</span>
        <span className="live">
          <span className="dot" />
          live · updates as tickets flow
        </span>
      </div>
      <p className="sub">
        Everything the automation is handling with no human involved. You
        don&apos;t move cards here — the clock does. You can only pull a card
        out (request review / escalate) if you need to.
      </p>
      <StatStrip stats={seeded ? stats : data.stats} />
      <AgentLog log={seeded ? log : data.log} />
      <PipelineColumns
        snapshot={data}
        intake={seeded ? intake : data.intake}
        waiting={seeded ? waiting : data.waiting}
        resolvedCount={seeded ? resolvedCount : data.resolved.count}
        simulatorSlot={<SimulatorControls autoRun={autoRun} />}
      />
    </main>
  );
}
