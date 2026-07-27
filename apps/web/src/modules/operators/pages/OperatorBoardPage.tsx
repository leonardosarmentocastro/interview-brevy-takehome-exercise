"use client";

import { useIssues } from "@/modules/operators/hooks/use-issues";
import { BoardColumn } from "@/modules/operators/components/BoardColumn";
import "../style.css";

export function OperatorBoardPage() {
  const { data, isLoading } = useIssues();

  if (isLoading || !data) {
    return <main data-testid="screen-operator">Loading…</main>;
  }

  const { columns } = data;

  return (
    <main data-testid="screen-operator">
      <div className="livebar">
        <span className="live">
          <span className="dot" />
          live · updates as tickets flow
        </span>
      </div>
      <div className="twozone">
        <div className="zone team">
          <div className="zhead">
            <span className="lbl">▤ Team backlog</span>
            <span className="exp">
              Unassigned — anyone can pick these up ·{" "}
              <span className="online">3 online</span>
            </span>
          </div>
          <BoardColumn
            title="Needs review"
            note="Pick one; it moves to your work and leaves others' view."
            cards={columns.needs_review}
            shared
            empty="Backlog clear"
          />
        </div>
        <div className="zone mine">
          <div className="zhead">
            <span className="lbl">◧ My work</span>
            <span className="exp">
              Tickets you picked up — only you see &amp; act on these.
            </span>
          </div>
          <div className="lanes">
            <BoardColumn
              title="In review"
              note="Actively working now."
              cards={columns.in_review}
              empty="Nothing in review"
            />
            <BoardColumn
              title="On hold"
              note="Parked, waiting on a customer/carrier."
              cards={columns.on_hold}
              empty="Nothing parked"
            />
            <BoardColumn
              title="Resolved"
              note="Closed by you today."
              cards={columns.resolved}
              resolvedSummary
            />
          </div>
        </div>
      </div>
    </main>
  );
}
