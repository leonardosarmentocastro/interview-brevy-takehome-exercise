"use client";
import { usePathname } from "next/navigation";

const HEADERS = [
  { match: "/monitors/agents", layer: 1, title: "Virtual agent — pipeline monitor" },
  { match: "/boards/operators", layer: 2, title: "Operator board — for human review" },
  { match: "/boards/specialists", layer: 3, title: "Specialist board — for fraud & escalations" },
] as const;

export function AppHeader({ onSwitchRole }: { onSwitchRole: () => void }) {
  const pathname = usePathname();
  const h = HEADERS.find((x) => pathname.startsWith(x.match)) ?? HEADERS[0];
  return (
    <div className="appbar">
      <div className="ttl">
        <span className="eyebrow">Pipeline · layer {h.layer} of 3</span>
        <h2>{h.title}</h2>
      </div>
      <div className="spacer" />
      <button className="idchip" onClick={onSwitchRole} aria-label="Switch role">
        <span className="ava">ADM</span>
        <span className="who"><span className="r">Admin</span><span className="h">switch role</span></span>
        <span className="car">▾</span>
      </button>
    </div>
  );
}
