"use client";

import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { DrillRow } from "@/modules/virtual_agents/types";
import "../style.css";

type DrillTableProps = {
  rows: DrillRow[];
  onOpen?: (analysisId: string) => void;
};

export function DrillTable({ rows, onOpen }: DrillTableProps) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Ticket</th>
          <th>Type</th>
          <th className="r">Amount</th>
          <th>Customer</th>
          <th>Resolved</th>
          <th>Rule fired</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            data-cat={r.cat}
            data-txt={r.txt}
            onClick={() => onOpen?.(r.analysis)}
          >
            <td className="id">{r.id}</td>
            <td className="ty">{r.type}</td>
            <td className="amt">{r.amountText}</td>
            <td>{r.customer}</td>
            <td className="time">{r.time}</td>
            <td className="rule" onClick={(e) => e.stopPropagation()}>
              <PolicyLink line={r.rule} />
            </td>
            <td className="chev">›</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
