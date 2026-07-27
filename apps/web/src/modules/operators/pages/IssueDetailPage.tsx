"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useIssue } from "@/modules/operators/hooks/use-issue";
import { DecisionRail } from "@/modules/operators/components/DecisionRail";
import { Timeline } from "@/modules/operators/components/Timeline";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import { formatMoney } from "@/modules/operators/utils/format-money";

const REC_BOX: Record<string, string> = {
  escalate: "border-[rgba(248,81,73,0.32)] bg-[rgba(248,81,73,0.08)]",
  recommend: "border-[rgba(63,185,80,0.32)] bg-[rgba(63,185,80,0.08)]",
  no_rule: "border-line bg-[rgba(139,151,168,0.08)]",
};

const REC_LEAD: Record<string, string> = {
  escalate: "text-bad",
  recommend: "text-ok",
  no_rule: "text-tx2",
};

const SLA: Record<string, string> = {
  none: "border-line text-tx3",
  soon: "border-[rgba(210,153,34,0.4)] bg-[rgba(210,153,34,0.1)] text-warn",
  breach: "border-[rgba(248,81,73,0.4)] bg-[rgba(248,81,73,0.1)] text-bad",
};

function ContextTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="mt-2.5 w-full border-collapse text-[13px] [&_tr:last-child>td]:border-b-0">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="w-[42%] border-b border-line px-0.5 py-[7px] align-top font-normal text-tx3">
              {k}
            </td>
            <td className="border-b border-line px-0.5 py-[7px] align-top font-normal text-tx">
              {v}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const SectionHeading = ({ children }: { children: ReactNode }) => (
  <h4 className="mb-[13px] text-[15px] font-semibold tracking-[-0.01em] text-tx">
    {children}
  </h4>
);

export function IssueDetailPage({ issueId }: { issueId: string }) {
  const { data: vm, isLoading } = useIssue(issueId);

  if (isLoading || !vm) {
    return <main data-testid="screen-issue-detail">Loading…</main>;
  }

  const d = vm.display;
  const dec = vm.decision;
  const c = vm.customer;
  const t = vm.transaction;
  const sh = t?.shipping;

  const related =
    dec?.related && dec.related.length
      ? `Also open for this customer: ${dec.related.join(", ")}.`
      : "No other open tickets for this customer.";

  const custRows: [string, ReactNode][] = [
    ["Name", `${d.customerName} · ${d.custId}`],
    ["Risk", d.riskScore],
    [
      "Lifetime",
      `${formatMoney(d.lifetimeSpend)} · ${c?.lifetime_transactions ?? 0} transactions`,
    ],
    ["Account", `since ${c?.account_created ?? "—"}`],
    ["Disputes", `${c?.disputes_filed ?? 0} filed`],
  ];

  const txnRows: [string, ReactNode][] = [
    ["Amount", d.amountText],
    ["Merchant", d.merchant],
    ["Purchased", `${(t?.created_at || "").slice(0, 10)} (${d.ageDays}d ago)`],
  ];
  if (sh) {
    txnRows.push(
      ["Carrier", sh.carrier],
      ["Status", sh.status],
      ["ETA", sh.estimated_delivery || "—"],
      ["Last scan", sh.last_location || "—"],
    );
  }

  return (
    <main data-testid="screen-issue-detail">
      <div className="mb-1.5 border-b border-line pb-3.5 pt-3">
        <Link
          className="rounded-[7px] border border-line px-[11px] py-1.5 font-mono text-[12.5px] text-tx3 no-underline transition-colors hover:border-tx3 hover:text-tx2"
          href="/boards/operators"
        >
          ← Board
        </Link>
      </div>

      <div className="grid grid-cols-1 items-start gap-0 md:grid-cols-[60%_40%]">
        <div className="flex flex-col gap-5 pb-[22px] pl-0.5 pr-0 pt-2 md:pr-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="font-mono text-[12.5px] text-tx3">
                {d.id} · {d.txnId}
              </span>
              {dec?.statusLabel && (
                <span className="rounded-full border border-[rgba(88,166,255,0.4)] px-[9px] py-0.5 font-mono text-[10px] uppercase tracking-[0.4px] text-info">
                  {dec.statusLabel}
                </span>
              )}
            </div>
            <div className="mb-2.5 flex items-baseline gap-4">
              <span className="text-[20px] font-semibold tracking-[-0.01em] text-tx">
                {dec?.typeLabelOverride || d.typeLabel}
              </span>
              <span className="text-[20px] text-tx">{d.amountText}</span>
            </div>
            {dec?.urgency && (
              <div>
                <span
                  className={`inline-flex gap-1 rounded-[5px] border px-[7px] py-0.5 font-mono text-[11px] ${SLA[dec.urgency.level]}`}
                >
                  {dec.urgency.label}
                </span>
              </div>
            )}
          </div>

          {dec?.why && (
            <div>
              <div
                className={`inline-block max-w-full rounded-[10px] border px-4 py-[13px] ${REC_BOX[dec.why.face]}`}
              >
                <div
                  className={`font-mono text-[14px] font-bold tracking-[0.2px] ${REC_LEAD[dec.why.face]}`}
                >
                  {dec.why.lead}
                </div>
                <div className="mt-2 text-[13.5px] leading-[1.55] text-tx2">
                  {dec.why.because}
                  {dec.why.ref != null && (
                    <>
                      <br />
                      <span className="mt-[9px] inline-block text-[13px]">
                        See <PolicyLink line={dec.why.ref} /> for reference
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <SectionHeading>How the agent reached this</SectionHeading>
            <Timeline trace={dec?.trace} />
            {dec?.dataGap && (
              <div className="mt-3.5 rounded-lg border border-[rgba(210,153,34,0.3)] bg-[rgba(210,153,34,0.06)] px-[13px] py-[11px]">
                <div className="mb-1.5 font-mono text-[10.5px] tracking-[0.4px] text-warn">
                  DATA GAP
                </div>
                <div className="text-[12.5px] leading-[1.5] text-tx2">
                  {dec.dataGap.text}
                </div>
              </div>
            )}
          </div>

          <hr className="my-0.5 border-0 border-t border-line" />

          <div>
            <SectionHeading>Context</SectionHeading>
            <div className="mt-0.5 grid grid-cols-1 gap-[22px] md:grid-cols-2">
              <div>
                <h5 className="text-[13px] font-semibold tracking-[-0.01em] text-tx2">
                  Customer
                </h5>
                <ContextTable rows={custRows} />
              </div>
              <div>
                <h5 className="text-[13px] font-semibold tracking-[-0.01em] text-tx2">
                  Transaction &amp; shipping
                </h5>
                <ContextTable rows={txnRows} />
              </div>
            </div>
          </div>

          <hr className="my-0.5 border-0 border-t border-line" />

          <div>
            <SectionHeading>Related</SectionHeading>
            <div className="text-[13.5px] text-tx3">{related}</div>
          </div>
        </div>

        {dec && <DecisionRail decision={dec} />}
      </div>
    </main>
  );
}
