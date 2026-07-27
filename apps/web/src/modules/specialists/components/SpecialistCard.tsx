"use client";

import Link from "next/link";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import type { SpecialistCard as SpecialistCardData } from "@/modules/specialists/types";
import { UrgencyBar } from "./UrgencyBar";
import "../style.css";

export function SpecialistCard({
  card,
  claimed = false,
  resolved = false,
  onClaim,
}: {
  card: SpecialistCardData;
  claimed?: boolean;
  resolved?: boolean;
  onClaim?: (id: string) => void;
}) {
  const isClaimed = claimed || card.claimed || !!card.owner;
  const breach = card.breach ? " breach" : "";

  return (
    <div className={`tk c-${card.crit}${breach}`} data-case={card.id}>
      {card.breach ? <span className="bump">⤒ bumped to top</span> : null}
      <div className="t1">
        <b>{card.type}</b>
        <span className="amt">{card.amountText}</span>
      </div>
      <div className="t2">{card.meta}</div>
      <div className="tags">
        <span className={`crt ${card.crit}`}>{card.tier}</span>
        {card.highValue ? <span className="rtag hv">high-value</span> : null}
        {card.owner || isClaimed ? (
          <span className="own">{resolved ? "✓" : "🔒"} you</span>
        ) : null}
      </div>
      {resolved && card.outcome ? (
        <div className="outcome">{card.outcome}</div>
      ) : card.bar ? (
        <UrgencyBar bar={card.bar} crit={card.crit} />
      ) : null}
      {!resolved && card.prov ? (
        <div className="prov">
          ↑{" "}
          <b>
            {card.prov.mode === "auto"
              ? "automatically escalated"
              : "manually escalated"}
          </b>{" "}
          {card.prov.mode === "auto" ? "by agent" : "by operator"} ·{" "}
          {card.prov.reason} · <PolicyLink line={card.prov.ref} />
        </div>
      ) : null}
      <div className="cardacts">
        <Link className="cbtn" href={`/boards/specialists/${card.id}`}>
          Open ticket
        </Link>
        {!isClaimed && !resolved ? (
          <button
            type="button"
            className="cbtn claim"
            onClick={() => onClaim?.(card.id)}
          >
            Claim
          </button>
        ) : null}
      </div>
    </div>
  );
}
