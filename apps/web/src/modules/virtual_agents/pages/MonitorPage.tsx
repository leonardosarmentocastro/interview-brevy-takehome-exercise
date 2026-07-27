"use client";

import { useMonitor } from "@/modules/virtual_agents/hooks/use-monitor";
import { StatStrip } from "@/modules/virtual_agents/components/StatStrip";
import { AgentLog } from "@/modules/virtual_agents/components/AgentLog";
import { PipelineColumns } from "@/modules/virtual_agents/components/PipelineColumns";
import "../style.css";

export function MonitorPage() {
  const { data, isLoading } = useMonitor();

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
      <StatStrip stats={data.stats} />
      <AgentLog log={data.log} />
      <PipelineColumns snapshot={data} />
    </main>
  );
}
