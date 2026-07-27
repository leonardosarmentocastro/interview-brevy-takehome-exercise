import type { MonitorStats } from "@/modules/virtual_agents/types";
import "../style.css";

export function StatStrip({ stats }: { stats: MonitorStats }) {
  return (
    <div className="stats">
      <div className="stat ok">
        <div className="k">Auto-resolved today</div>
        <div className="v" id="stat-resolved">
          {stats.resolved}
        </div>
        <div className="d">{stats.autoPct}% of all intake</div>
      </div>
      <div className="stat watch">
        <div className="k">Waiting (system-managed)</div>
        <div className="v" id="stat-waiting">
          {stats.waiting}
        </div>
        <div className="d">retries · nudges · grace clocks</div>
      </div>
      <div className="stat back">
        <div className="k">→ Sent for human review</div>
        <div className="v" id="stat-human">
          {stats.humanReview}
        </div>
        <div className="d">policy couldn&apos;t decide</div>
      </div>
      <div className="stat esc">
        <div className="k">→ Escalated to specialist</div>
        <div className="v" id="stat-escalated">
          {stats.escalated}
        </div>
        <div className="d">disputes over $200</div>
      </div>
    </div>
  );
}
