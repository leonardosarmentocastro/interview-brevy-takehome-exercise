# Auto-resolved drill page visual fidelity

**Date:** 2026-07-27  
**Status:** approved  
**Scope:** `apps/web` — `/monitors/agents/drill` only

## Problem

Side-by-side with the sample drill view, the React rewrite differs in four ways:

1. **Appbar** — “Virtual agent — pipeline monitor” (plus Admin chip) appears on drill because `AppHeader` matches `/monitors/agents` via `pathname.startsWith`. Sample’s `showDrill()` renders drill + pipeline nav only — no appbar.
2. **Title weight** — “Auto-resolved” looks lighter than sample. Tailwind preflight resets `h1` weight; sample `.head h1` relies on browser-default bold.
3. **Sub description** — `.sub` has `max-width: 720px`, so the intro wraps early; sample lets it span the content width.
4. **Rule fired links** — `PolicyLink` is info blue globally; sample greens links in `.tbl td.rule .plink` (and the pattern callout uses the same green look).

## Goal

Match the sample auto-resolved full-log screen for appbar presence, title weight, subtitle width, and green policy links in the table (and pattern callout).

## Non-goals

- Monitor page appbar / description (keep as-is)
- Operators / specialists headers
- Resolved drawer (already addressed)
- Changing global `.plink` default color outside drill table/pattern contexts

## Approach

Targeted CSS + header routing (not a full Tailwind rewrite of DrillPage):

| Fix | Implementation |
|---|---|
| Hide appbar on drill | `ConsoleFrame` (or `AppHeader` caller) skips rendering `AppHeader` when pathname is `/monitors/agents/drill` (exact or ends with `/drill` under agents). |
| Title weight | `.head h1 { font-weight: 700 }` in `virtual_agents/style.css`. |
| Sub width | Remove `max-width: 720px` from `.sub`. |
| Green rule links | Add `.tbl td.rule .plink { color: var(--color-ok) }` (and hover). Green the pattern-callout `PolicyLink` the same way (e.g. `.pattern .plink`). |

## Testing

- **AppHeader / ConsoleFrame:** drill path does not show “Virtual agent — pipeline monitor”; monitor path still does.
- **DrillPage / DrillTable:** rule-column / pattern links expose ok-colored plink styling (class or computed contract); existing content tests remain green.

## Success criteria

Side-by-side with sample drill: no appbar, bolder “Auto-resolved”, single-line-capable subtitle, green `policies.md:N` in Rule fired and pattern callout.
