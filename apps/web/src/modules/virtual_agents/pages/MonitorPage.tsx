"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useMonitor } from "@/modules/virtual_agents/hooks/use-monitor";
import { StatStrip } from "@/modules/virtual_agents/components/StatStrip";
import { AgentLog } from "@/modules/virtual_agents/components/AgentLog";
import { PipelineColumns } from "@/modules/virtual_agents/components/PipelineColumns";
import { SimulatorControls } from "@/modules/virtual_agents/components/SimulatorControls";
import { IntakeDrawer } from "@/modules/virtual_agents/components/IntakeDrawer";
import { ResolvedDrawer } from "@/modules/virtual_agents/components/ResolvedDrawer";
import {
  simInitAtom,
  intakeQueueAtom,
  waitingAtom,
  resolvedCountAtom,
  logAtom,
  statsAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";
import {
  drawerAtom,
  openDrawerAtom,
} from "@/modules/virtual_agents/data/atoms/drawer";
import type { IntakeItem } from "@/modules/virtual_agents/types";
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
  const drawer = useAtomValue(drawerAtom);
  const openDrawer = useSetAtom(openDrawerAtom);

  useEffect(() => {
    if (!data || seeded) return;
    init(data);
    setSeeded(true);
  }, [data, init, seeded]);

  if (isLoading || !data) {
    return <main data-testid="screen-monitor">Loading…</main>;
  }

  const liveIntake = seeded ? intake : data.intake;
  const intakeItem: IntakeItem | undefined =
    drawer?.kind === "intake"
      ? (liveIntake.find((x) => x.id === drawer.id) as IntakeItem | undefined) ??
        data.intake.find((x) => x.id === drawer.id)
      : undefined;
  const analysis =
    drawer?.kind === "resolved" ? data.analysis[drawer.id] : undefined;

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
        intake={liveIntake}
        waiting={seeded ? waiting : data.waiting}
        resolvedCount={seeded ? resolvedCount : data.resolved.count}
        simulatorSlot={<SimulatorControls autoRun={autoRun} />}
        onOpenIntake={(id) => openDrawer({ kind: "intake", id })}
        onOpenResolved={(id) => openDrawer({ kind: "resolved", id })}
      />
      {intakeItem ? <IntakeDrawer item={intakeItem} /> : null}
      {analysis ? <ResolvedDrawer analysis={analysis} /> : null}
    </main>
  );
}
