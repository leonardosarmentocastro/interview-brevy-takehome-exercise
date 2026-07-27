"use client";

import type { IntakeItem, SimTicket } from "@/modules/virtual_agents/types";

type IntakeCardProps = {
  item: IntakeItem | SimTicket;
  onOpen?: (id: string) => void;
};

export function IntakeCard({ item, onOpen }: IntakeCardProps) {
  return (
    <div className="tk eval" data-intake={item.id}>
      <div className="t1">
        <b>{item.type}</b>
        <span className="amt">{item.amountText}</span>
      </div>
      <div className="t2">{item.meta}</div>
      <span className="blocker eval">
        <span className="evaldot" /> evaluating against policy…
      </span>
      <button
        type="button"
        className="viewbtn"
        onClick={() => onOpen?.(item.id)}
      >
        View ticket (facts only) →
      </button>
    </div>
  );
}
