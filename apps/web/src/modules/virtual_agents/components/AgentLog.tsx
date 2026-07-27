"use client";

import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { LogEntry } from "@/modules/virtual_agents/types";
import "../style.css";

const LOG_CLASS: Record<string, string> = {
  resolved: "res",
  leak: "leak",
  escalated: "esc",
  grab: "",
};

export function AgentLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return null;
  const latest = log[0];

  return (
    <details className="log">
      <summary>
        <span className="llead">
          <span className="d" />
          Agent log
        </span>
        <span className="latest">
          <b>{latest.t}</b>
          {" · "}
          {/* Fixtures are trusted authored HTML (may contain <b>). */}
          <span dangerouslySetInnerHTML={{ __html: latest.text }} />
        </span>
        <span className="count">{log.length} events today</span>
      </summary>
      <div className="stream">
        {log.map((e, i) => (
          <div key={`${e.t}-${i}`} className={`lrow ${LOG_CLASS[e.kind] ?? ""}`}>
            <span className="lt">{e.t}</span>
            <span className="lx">
              {/* Fixtures are trusted authored HTML (may contain <b>). */}
              <span dangerouslySetInnerHTML={{ __html: e.text }} />
              {e.refs.length > 0 && (
                <>
                  {" · "}
                  {e.refs.map((n, ri) => (
                    <span key={n}>
                      {ri > 0 ? ", " : null}
                      <PolicyLink line={n} />
                    </span>
                  ))}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
