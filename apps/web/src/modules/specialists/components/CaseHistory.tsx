"use client";

import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { CaseHistoryNode } from "@/modules/specialists/types";
import "../style.css";

export function CaseHistory({ nodes }: { nodes: CaseHistoryNode[] }) {
  return (
    <div className="tl">
      {nodes.map((n, i) => {
        if (n.end) {
          return (
            <div
              key={i}
              className={`step end ${n.endCrit ?? ""}`.trim()}
            >
              <div className="dot" />
              <div className="shead">
                <span className="actor you">{n.actor}</span>
              </div>
              {n.concl ? <div className="concl">{n.concl}</div> : null}
            </div>
          );
        }

        const actorClass = n.actorClass ?? (n.actor === "you" ? "you" : "");
        const when = n.when ?? n.t ?? "";
        const line = n.line ?? n.val ?? "";

        return (
          <div key={i} className={`step${n.fired ? " f" : ""}`}>
            <div className="dot" />
            <div className="shead">
              <span className={`actor ${actorClass}`.trim()}>{n.actor}</span>
              {n.ref != null ? <PolicyLink line={n.ref} /> : null}
              <span className="st">{n.st ?? when}</span>
            </div>
            {n.rows
              ? n.rows.map(([pfx, val]) => (
                  <div className="ln" key={`${pfx}-${val}`}>
                    <span className="pfx">{pfx}</span>
                    <span
                      className="val"
                      dangerouslySetInnerHTML={{ __html: val }}
                    />
                  </div>
                ))
              : line
                ? (
                    <div className="ln">
                      <span className="val">{line}</span>
                    </div>
                  )
                : null}
            {n.note ? <div className="note">{n.note}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
