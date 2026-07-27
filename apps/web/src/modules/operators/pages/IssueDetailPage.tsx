"use client";

import Link from "next/link";
import { useIssue } from "@/modules/operators/hooks/use-issue";
import { DecisionRail } from "@/modules/operators/components/DecisionRail";
import { Timeline } from "@/modules/operators/components/Timeline";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import { formatMoney } from "@/modules/operators/utils/format-money";
import "../style.css";

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

  return (
    <main data-testid="screen-issue-detail">
      <div className="topbar">
        <Link className="back" href="/boards/operators">
          ← Board
        </Link>
      </div>
      <div className="grid">
        <div className="main">
          <div className="thead">
            <div className="l1">
              <span className="ids">
                {d.id} · {d.txnId}
              </span>
              {dec?.statusLabel && (
                <span className="statuspill">{dec.statusLabel}</span>
              )}
            </div>
            <div className="l2">
              <span className="type">
                {dec?.typeLabelOverride || d.typeLabel}
              </span>
              <span className="amt">{d.amountText}</span>
            </div>
            {dec?.urgency && (
              <div>
                <span className="sla">{dec.urgency.label}</span>
              </div>
            )}
          </div>

          {dec?.why && (
            <div className="sect">
              <div className={`rec ${dec.why.face}`}>
                <div className="lead">{dec.why.lead}</div>
                <div className="bc">
                  {dec.why.because}
                  {dec.why.ref != null && (
                    <>
                      <br />
                      <span className="ref">
                        See <PolicyLink line={dec.why.ref} /> for reference
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="sect">
            <h4>How the agent reached this</h4>
            <Timeline trace={dec?.trace} />
            {dec?.dataGap && (
              <div className="datagap">
                <div className="t">DATA GAP</div>
                <div className="b">{dec.dataGap.text}</div>
              </div>
            )}
          </div>

          <hr className="rule" />

          <div className="sect">
            <h4>Context</h4>
            <div className="ctxwrap">
              <div>
                <h5>Customer</h5>
                <table className="ctable">
                  <tbody>
                    <tr>
                      <td className="k">Name</td>
                      <td className="v">
                        {d.customerName} · {d.custId}
                      </td>
                    </tr>
                    <tr>
                      <td className="k">Risk</td>
                      <td className="v">{d.riskScore}</td>
                    </tr>
                    <tr>
                      <td className="k">Lifetime</td>
                      <td className="v">
                        {formatMoney(d.lifetimeSpend)} ·{" "}
                        {c?.lifetime_transactions ?? 0} transactions
                      </td>
                    </tr>
                    <tr>
                      <td className="k">Account</td>
                      <td className="v">since {c?.account_created ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="k">Disputes</td>
                      <td className="v">{c?.disputes_filed ?? 0} filed</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h5>Transaction &amp; shipping</h5>
                <table className="ctable">
                  <tbody>
                    <tr>
                      <td className="k">Amount</td>
                      <td className="v">{d.amountText}</td>
                    </tr>
                    <tr>
                      <td className="k">Merchant</td>
                      <td className="v">{d.merchant}</td>
                    </tr>
                    <tr>
                      <td className="k">Purchased</td>
                      <td className="v">
                        {(t?.created_at || "").slice(0, 10)} ({d.ageDays}d ago)
                      </td>
                    </tr>
                    {sh && (
                      <>
                        <tr>
                          <td className="k">Carrier</td>
                          <td className="v">{sh.carrier}</td>
                        </tr>
                        <tr>
                          <td className="k">Status</td>
                          <td className="v">{sh.status}</td>
                        </tr>
                        <tr>
                          <td className="k">ETA</td>
                          <td className="v">
                            {sh.estimated_delivery || "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="k">Last scan</td>
                          <td className="v">{sh.last_location || "—"}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <hr className="rule" />

          <div className="sect">
            <h4>Related</h4>
            <div className="rel">{related}</div>
          </div>
        </div>
        {dec && <DecisionRail decision={dec} />}
      </div>
    </main>
  );
}
