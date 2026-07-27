import type { WaitItem } from "@/modules/virtual_agents/types";

export function WaitCard({ item }: { item: WaitItem }) {
  return (
    <div className="tk wait" data-wait={item.id}>
      <div className="t1">
        <b>{item.type}</b>
        <span className="amt">{item.amountText}</span>
      </div>
      <div className="t2">{item.meta}</div>
      <span className="blocker">{item.blocker}</span>
      <div className="hatch">
        <button type="button" className="hbtn">
          Request human review →
        </button>
        <button type="button" className="hbtn esc">
          Escalate to specialist →
        </button>
      </div>
    </div>
  );
}
