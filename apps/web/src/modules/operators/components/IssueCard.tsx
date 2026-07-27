"use client";

import Link from "next/link";
import type { IssueViewModel } from "@/modules/operators/types";
import "../style.css";

const URGENCY_CLASS = {
  breach: "u-breach",
  soon: "u-soon",
  none: "u-none",
} as const;

const SLA_CLASS = {
  breach: "breach",
  soon: "soon",
  none: "none",
} as const;

function WhyChip({ why }: { why: NonNullable<IssueViewModel["decision"]>["why"] }) {
  if (!why) return null;
  if (why.face === "recommend") {
    return (
      <div className="rec-inline">
        <div className="l">✓ {why.lead}</div>
      </div>
    );
  }
  if (why.face === "escalate") {
    return <span className="chip esc">{why.lead}</span>;
  }
  return <span className="chip none">{why.lead}</span>;
}

export function IssueCard({ vm }: { vm: IssueViewModel }) {
  const { display: d, decision: dec } = vm;
  const level = dec?.urgency?.level ?? "none";
  const urgencyClass = URGENCY_CLASS[level] ?? "u-none";
  const slaClass = SLA_CLASS[level] ?? "none";
  const title = dec?.typeLabelOverride || d.typeLabel;
  const rec = dec?.actions?.recommended;

  return (
    <Link
      href={`/boards/operators/${vm.issue.id}`}
      className={`tk ${urgencyClass}`}
      data-issue={vm.issue.id}
    >
      <div className="t1">
        <b>{title}</b>
        <span className="amt">{d.amountText}</span>
      </div>
      <div className="t2">
        {d.id} · {d.customerName} · {d.merchant} · {d.ageDays}d
      </div>
      <div className="tags">
        {d.isHighValue ? (
          <span className="rtag hv">high-value</span>
        ) : (
          <span className="rtag">risk {d.riskScore}</span>
        )}
      </div>
      {dec?.urgency && (
        <span className={`sla ${slaClass}`}>{dec.urgency.label}</span>
      )}
      <WhyChip why={dec?.why} />
      <div className="cardacts">
        <span className="cbtn">Open ticket</span>
        {rec ? (
          <span className="cbtn go">{rec.label.replace(/^[▲✓◆]\s*/, "")}</span>
        ) : (
          <span className="cbtn">Claim</span>
        )}
      </div>
    </Link>
  );
}
