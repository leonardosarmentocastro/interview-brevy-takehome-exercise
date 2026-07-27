import type { AgentSummary as AgentSummaryType } from "@/modules/operators/types";

export function AgentSummary({ summary }: { summary: AgentSummaryType }) {
  const t = summary.totals;
  return (
    <div className="agent">
      <div className="agent-h">
        <span className="ico">◆</span>
        <h3>Virtual agent — today</h3>
        <span className="tag">machine · read-only</span>
      </div>
      <details className="ag">
        <summary>
          <span className="tot ok">
            <span className="k">Auto-resolved</span>
            <span className="v">{t.resolved}</span>
          </span>
          <span className="tot watch">
            <span className="k">Waiting</span>
            <span className="v">{t.waiting}</span>
          </span>
          <span className="tot back">
            <span className="k">Sent to team backlog</span>
            <span className="v">{t.backlog}</span>
          </span>
          <span className="tot esc">
            <span className="k">Escalated to specialist</span>
            <span className="v">{t.escalated}</span>
          </span>
          <span className="more">per-category</span>
        </summary>
        <table className="mtx">
          <thead>
            <tr>
              <th>Category</th>
              <th className="h-ok">Auto-resolved</th>
              <th className="h-watch">Waiting</th>
              <th className="h-back">→ Team backlog</th>
              <th className="h-esc">→ Specialist</th>
            </tr>
          </thead>
          <tbody>
            {summary.categories.map((c) => (
              <tr key={c.name}>
                <td className="cat">{c.name}</td>
                <td>{c.resolved}</td>
                <td>{c.waiting}</td>
                <td className="v-back">
                  {c.backlog || <span className="z">0</span>}
                </td>
                <td className="v-esc">
                  {c.escalated || <span className="z">0</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
