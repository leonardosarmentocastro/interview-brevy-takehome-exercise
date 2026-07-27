"use client";

import Link from "next/link";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMonitor } from "@/modules/virtual_agents/hooks/use-monitor";
import { DrillTable } from "@/modules/virtual_agents/components/DrillTable";
import { ResolvedDrawer } from "@/modules/virtual_agents/components/ResolvedDrawer";
import {
  drillCatAtom,
  drillQueryAtom,
  filterRows,
} from "@/modules/virtual_agents/data/atoms/drill-filter";
import {
  drawerAtom,
  openDrawerAtom,
} from "@/modules/virtual_agents/data/atoms/drawer";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import "../style.css";

export function DrillPage() {
  const { data, isLoading } = useMonitor();
  const [cat, setCat] = useAtom(drillCatAtom);
  const [query, setQuery] = useAtom(drillQueryAtom);
  const drawer = useAtomValue(drawerAtom);
  const openDrawer = useSetAtom(openDrawerAtom);

  if (isLoading || !data) {
    return <main data-testid="screen-drill">Loading…</main>;
  }

  const { drill } = data;
  const rows = filterRows(drill.rows, cat, query);
  const analysis =
    drawer?.kind === "resolved" ? data.analysis[drawer.id] : undefined;

  return (
    <main data-testid="screen-drill">
      <div className="crumb">
        <Link className="back" href="/monitors/agents">
          ← Back to monitor
        </Link>
        <span className="path">
          Virtual agent / <b>Auto-resolved · full log</b>
        </span>
      </div>
      <div className="head">
        <h1>Auto-resolved</h1>
        <span className="tag">machine · read-only</span>
      </div>
      <p className="sub">
        Every ticket the agent closed today with no human involved. Searchable
        and filterable — click any row to audit the reasoning.
      </p>
      <div className="toolbar">
        <input
          className="search"
          placeholder="search id, customer, merchant…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {drill.chips.map((c) => (
            <button
              key={c.cat}
              type="button"
              className={`chip${cat === c.cat ? " on" : ""}`}
              onClick={() => setCat(c.cat)}
            >
              {c.label} <span className="c">{c.n}</span>
            </button>
          ))}
        </div>
      </div>
      <DrillTable
        rows={rows}
        onOpen={(id) => openDrawer({ kind: "resolved", id })}
      />
      {rows.length === 0 ? (
        <div className="norows">No tickets match.</div>
      ) : null}
      <div className="count-note">
        showing <b>{rows.length}</b> of <b>{drill.total}</b>
      </div>
      <div className="pattern">
        <span className="lb">◆ policy-quality read</span>
        <b>
          {drill.pattern.count} of {drill.pattern.total}
        </b>{" "}
        auto-resolves today fired on a single rule —{" "}
        <PolicyLink line={drill.pattern.rule} /> (refund within window, not
        shipped). If that clause is too permissive, it&apos;s silently approving
        at volume.
      </div>
      {analysis ? <ResolvedDrawer analysis={analysis} /> : null}
    </main>
  );
}
