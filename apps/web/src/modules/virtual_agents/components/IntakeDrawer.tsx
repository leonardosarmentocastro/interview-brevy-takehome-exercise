"use client";

import { useSetAtom } from "jotai";
import type { IntakeItem } from "@/modules/virtual_agents/types";
import { closeDrawerAtom } from "@/modules/virtual_agents/data/atoms/drawer";
import "../style.css";

function FactTable({ pairs }: { pairs: [string, string][] }) {
  return (
    <table className="dtable">
      <tbody>
        {pairs.map(([k, v]) => (
          <tr key={k}>
            <td className="k">{k}</td>
            <td className="v">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function IntakeDrawer({
  item,
}: {
  item: Pick<IntakeItem, "id" | "type" | "amountText" | "facts">;
}) {
  const close = useSetAtom(closeDrawerAtom);
  return (
    <div className="drawerwrap open">
      <div
        className="drawerbg"
        data-testid="drawer-backdrop"
        onClick={() => close()}
      />
      <div className="drawer">
        <div className="dh">
          <span className="ids">{item.id}</span>
          <button type="button" className="close" onClick={() => close()}>
            ✕
          </button>
        </div>
        <span className="dpill intake">Intake — not yet evaluated</span>
        <div className="dtype">
          <span className="ty">{item.type}</span>
          <span className="am">{item.amountText}</span>
        </div>
        <div className="dsec">Ticket</div>
        <FactTable pairs={item.facts.ticket} />
        <div className="dsec">Customer</div>
        <FactTable pairs={item.facts.customer} />
        <div className="dnote">
          <b>No agent analysis yet.</b> This ticket is still in intake — the
          engine hasn&apos;t evaluated it against policy. Facts only: no
          recommendation, no decision timeline. Those appear once it moves into
          Waiting or Resolved.
        </div>
      </div>
    </div>
  );
}
