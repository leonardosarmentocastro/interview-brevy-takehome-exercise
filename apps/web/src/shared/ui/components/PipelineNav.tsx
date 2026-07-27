"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../style.css";

const STEPS = [
  { href: "/monitors/agents", icon: "🖥️", title: "Virtual agent", sub: "pipeline monitor" },
  { href: "/boards/operators", icon: "📋", title: "Operator board", sub: "for human review" },
  { href: "/boards/specialists", icon: "🔎", title: "Specialist board", sub: "for fraud & escalations" },
] as const;

export function PipelineNav() {
  const pathname = usePathname();
  return (
    <nav className="pnav">
      {STEPS.map((s, i) => {
        const active = pathname.startsWith(s.href);
        return (
          <span key={s.href} className="pstep-wrap">
            {i > 0 && <span className="arr">⟶</span>}
            <Link href={s.href} className={`pstep${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="pi">{s.icon}</span>
              <span className="ptxt"><span className="pt">{s.title}</span><span className="ps">{s.sub}</span></span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
