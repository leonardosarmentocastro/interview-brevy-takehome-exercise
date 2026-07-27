"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCase } from "@/modules/specialists/hooks/use-case";
import { UrgencyBar } from "@/modules/specialists/components/UrgencyBar";
import { CaseHistory } from "@/modules/specialists/components/CaseHistory";
import { CaseRail } from "@/modules/specialists/components/CaseRail";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import "../style.css";

function HtmlWithRefs({ html }: { html: string }) {
  const parts = html.split(/(REF\d+)/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = /^REF(\d+)$/.exec(part);
        if (m) return <PolicyLink key={i} line={Number(m[1])} />;
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
        );
      })}
    </>
  );
}

function CtxTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, string, string?][];
}) {
  return (
    <div>
      <div className="grp">{title}</div>
      <table className="ctable">
        <tbody>
          {rows.map(([k, v, missing]) => (
            <tr key={k}>
              <td className="k">{k}</td>
              <td className={`v${missing ? " missing" : ""}`}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CasePage({ caseId }: { caseId: string }) {
  const { data: c, isLoading } = useCase(caseId);

  if (isLoading || !c) {
    return <main data-testid="screen-case">Loading…</main>;
  }

  const provLead =
    c.prov.mode === "auto"
      ? "↑ AUTOMATICALLY ESCALATED BY AGENT"
      : "↑ MANUALLY ESCALATED BY OPERATOR";

  const historyTitle: ReactNode =
    c.prov.mode === "auto"
      ? "Case history — agent → you"
      : "Case history — agent → operator → you";

  return (
    <main data-testid="screen-case">
      <div className="topbar">
        <Link className="back" href="/boards/specialists">
          ← Board
        </Link>
        <span className="path">
          Specialist board /{" "}
          <b>
            {c.id} · {c.type}
          </b>
        </span>
      </div>
      <div className="grid">
        <div className="main">
          <div className="thead">
            <div className="l1">
              <span className="ids">
                {c.id} · {c.txnId}
              </span>
              <span className="statuspill">{c.status}</span>
            </div>
            <div className="l2">
              <span className="type">{c.type}</span>
              <span className="amt">{c.amountText}</span>
            </div>
            <div className="l1">
              <span className={`crt ${c.crit}`}>{c.tier}</span>
            </div>
            {c.bar ? <UrgencyBar bar={c.bar} crit={c.crit} /> : null}
          </div>

          <div className="prov-b">
            <div className="lead">{provLead}</div>
            <div className="bc">
              <HtmlWithRefs html={c.prov.because} />
            </div>
          </div>

          <div>
            <h4 className="sh">{historyTitle}</h4>
            <CaseHistory nodes={c.history} />
          </div>

          <div className="datagap">
            <div className="t">⚠ DATA GAP</div>
            <div className="b">
              <HtmlWithRefs html={c.dataGap.html} />
            </div>
            {c.dataGap.staged ? (
              <div className="staged">{c.dataGap.staged}</div>
            ) : null}
          </div>

          <hr className="rule" />

          <div>
            <h4 className="sh">Context</h4>
            <div className="ctxwrap">
              <CtxTable title={c.context.left.title} rows={c.context.left.rows} />
              <CtxTable
                title={c.context.right.title}
                rows={c.context.right.rows}
              />
            </div>
          </div>

          <hr className="rule" />

          <div>
            <h4 className="sh">Related</h4>
            <div className="rel">{c.related}</div>
          </div>
        </div>

        <CaseRail case={c} />
      </div>
    </main>
  );
}
