import type { ReactNode } from "react";
import type { IssueViewModel } from "@/modules/operators/types";
import { IssueCard } from "./IssueCard";

type BoardColumnProps = {
  title: string;
  note?: string;
  cards: IssueViewModel[];
  shared?: boolean;
  empty?: string;
  resolvedSummary?: boolean;
  count?: number;
  children?: ReactNode;
};

export function BoardColumn({
  title,
  note,
  cards,
  shared,
  empty = "Nothing here",
  resolvedSummary,
  count,
}: BoardColumnProps) {
  const n = count ?? cards.length;
  return (
    <div className={`col${shared ? " shared" : ""}`}>
      <div className="col-h">
        <h4>{title}</h4>
        <span className="n">{n}</span>
      </div>
      {note ? <p className="col-note">{note}</p> : null}
      {resolvedSummary ? (
        <div className="resolved-sum">
          <b>{n} resolved by you</b> today
          <br />
          <span className="mach">+ 214 resolved automatically by the agent</span>
        </div>
      ) : cards.length ? (
        cards.map((vm) => <IssueCard key={vm.issue.id} vm={vm} />)
      ) : (
        <div className="empty">{empty}</div>
      )}
    </div>
  );
}
