"use client";

import { useEffect } from "react";
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
  simSeededAtom,
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
import "../style.css";

export function MonitorPage({ autoRun = true }: { autoRun?: boolean }) {
  const { data, isLoading } = useMonitor();
  const init = useSetAtom(simInitAtom);
  const seeded = useAtomValue(simSeededAtom);

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
  }, [data, init, seeded]);

  if (isLoading || !data) {
    return <main data-testid="screen-monitor">Loading…</main>;
  }

  const liveIntake = seeded ? intake : data.intake;
  const found =
    drawer?.kind === "intake"
      ? liveIntake.find((x) => x.id === drawer.id) ??
        data.intake.find((x) => x.id === drawer.id)
      : undefined;
  const intakeItem =
    found && "facts" in found && found.facts ? found : undefined;
  const analysis =
    drawer?.kind === "resolved" ? data.analysis[drawer.id] : undefined;

  return (
    <main data-testid="screen-monitor">
      <div className="livebar">
        <span className="live">
          <span className="dot" />
          live · updates as tickets flow
        </span>
      </div>
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
