"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useSpecialist } from "@/modules/specialists/hooks/use-specialist";
import {
  filterCards,
  specCatAtom,
  specQueryAtom,
} from "@/modules/specialists/data/atoms/filter";
import {
  claimAtom,
  claimedIdsAtom,
  deriveLanes,
} from "@/modules/specialists/data/atoms/claims";
import { Toolbar } from "@/modules/specialists/components/Toolbar";
import { SpecialistCard } from "@/modules/specialists/components/SpecialistCard";
import type { SpecialistCard as Card } from "@/modules/specialists/types";
import "../style.css";

function Lane({
  title,
  note,
  cards,
  claimed,
  resolved,
  shared,
  onClaim,
}: {
  title: string;
  note: string;
  cards: Card[];
  claimed?: boolean;
  resolved?: boolean;
  shared?: boolean;
  onClaim?: (id: string) => void;
}) {
  return (
    <div className={`col sbcol${shared ? " shared" : ""}`}>
      <div className="col-h">
        <h4>{title}</h4>
        <span className="n">{cards.length}</span>
      </div>
      <p className="col-note">{note}</p>
      <div className="cards">
        {cards.length ? (
          cards.map((c) => (
            <SpecialistCard
              key={c.id}
              card={c}
              claimed={claimed || c.claimed}
              resolved={resolved}
              onClaim={onClaim}
            />
          ))
        ) : (
          <div className="empty">Nothing here</div>
        )}
      </div>
    </div>
  );
}

export function SpecialistBoardPage() {
  const { data, isLoading } = useSpecialist();
  const cat = useAtomValue(specCatAtom);
  const query = useAtomValue(specQueryAtom);
  const claimedIds = useAtomValue(claimedIdsAtom);
  const claim = useSetAtom(claimAtom);

  if (isLoading || !data) {
    return <main data-testid="screen-specialist">Loading…</main>;
  }

  const lanes = deriveLanes(
    data.queue,
    data.mine.investigating ?? [],
    claimedIds,
  );
  const queue = filterCards(lanes.queue, cat, query);
  const investigating = lanes.investigating;
  const onhold = data.mine.onhold ?? [];
  const resolved = data.mine.resolved ?? [];

  return (
    <main data-testid="screen-specialist">
      <Toolbar />
      <div className="boardarea">
        <div className="twozone">
          <div className="zone team">
            <div className="zhead">
              <span className="lbl">TEAM · Escalation queue</span>
              <span className="exp">
                Unassigned — any specialist can claim these ·{" "}
                <span className="online">{data.online} online</span>
              </span>
            </div>
            <Lane
              title="Needs investigation"
              note={`${data.breakdown} — claim one to lock it to you & leave others' view.`}
              cards={queue}
              shared
              onClaim={(id) => claim(id)}
            />
          </div>
          <div className="zone mine">
            <div className="zhead">
              <span className="lbl">MINE · My work</span>
              <span className="exp">
                Cases you claimed (Sam) — only you see &amp; act on these.
              </span>
            </div>
            <div className="lanes">
              <Lane
                title="Investigating"
                note="Actively working now."
                cards={investigating}
                claimed
              />
              <Lane
                title="On hold"
                note="Awaiting an external party (bank / carrier / customer)."
                cards={onhold}
                claimed
              />
              <Lane
                title="Resolved"
                note="Closed by you — terminal."
                cards={resolved}
                claimed
                resolved
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
