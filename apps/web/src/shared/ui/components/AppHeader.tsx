"use client";
import { usePathname } from "next/navigation";

const HEADERS = [
  {
    match: "/monitors/agents",
    layer: 1,
    title: "Virtual agent — pipeline monitor",
    tag: "machine · read-only",
    description:
      "Everything the automation is handling with no human involved. You don't move cards here — the clock does. You can only pull a card out (request review / escalate) if you need to.",
  },
  {
    match: "/boards/operators",
    layer: 2,
    title: "Operator board — for human review",
    description:
      "Human review queue for cases the virtual agent couldn’t close. Claim a card, act on it, or escalate to a specialist.",
  },
  {
    match: "/boards/specialists",
    layer: 3,
    title: "Specialist board — for fraud & escalations",
  },
] as const;

export function AppHeader({ onSwitchRole }: { onSwitchRole: () => void }) {
  const pathname = usePathname();
  const h = HEADERS.find((x) => pathname.startsWith(x.match)) ?? HEADERS[0];
  return (
    <div className="appbar">
      <div className="ttl">
        <span className="eyebrow">
          Pipeline · layer {h.layer} of 3
          {"tag" in h && h.tag ? <span className="htag">{h.tag}</span> : null}
        </span>
        <h2>{h.title}</h2>
        {"description" in h && h.description ? (
          <p className="hdesc">{h.description}</p>
        ) : null}
      </div>
      <button className="idchip" onClick={onSwitchRole} aria-label="Switch role">
        <span className="ava">ADM</span>
        <span className="who"><span className="r">Admin</span><span className="h">switch role</span></span>
        <span className="car">▾</span>
      </button>
    </div>
  );
}
