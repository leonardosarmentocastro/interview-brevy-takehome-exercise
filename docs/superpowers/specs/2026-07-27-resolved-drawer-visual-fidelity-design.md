# Resolved drawer visual fidelity

**Date:** 2026-07-27  
**Status:** approved  
**Scope:** `apps/web` — `ResolvedDrawer` only

## Problem

The React rewrite of the virtual-agent Resolved drawer diverges from the sample:

- Auto-resolve alert (`.rec`) renders dark instead of green-tinted
- Timeline markers wrong size/color; `✓ fired` / `✓ applied` not green
- RULE / EVIDENCE typography heavier and less compact than sample

**Root cause:** shared class names (`.rec`, `.tl`, `.step`, `.dot`, `.st`, `.pfx`, `.ln`, `.concl`) collide with `operators` / `specialists` module CSS. Those modules use higher specificity (e.g. `.tl .step .dot`) or load later, so monitor styles lose.

The correct monitor values already exist in `virtual_agents/style.css`; they do not win in the cascade.

## Goal

Make the Resolved drawer match the sample’s auto-resolve chrome visually, without relying on those colliding class names.

## Non-goals

- Operators / specialists timeline or recommendation styling
- Intake drawer, drill page, or other monitor regions
- Broad CSS namespacing across the monorepo
- Changing `PolicyLink` color (sample global `.plink` is info blue)

## Approach

Replace colliding class-based styling in `ResolvedDrawer.tsx` with **Tailwind utilities** that reference existing `@theme` tokens in `globals.css` (`ok`, `tx`, `tx2`, `tx3`, `line`, `bg`, `font-mono`).

Shell chrome that does not collide meaningfully (`.drawerwrap`, `.drawer`, `.dh`, `.dpill`, `.dtype`, `.dsec`, `.dtable`, `.dfoot`) may remain on existing classes.

## Visual contract (from sample monitor CSS)

| Region | Look |
|---|---|
| Alert box | `border-radius: 10px`; padding `12px 14px`; border `rgba(63,185,80,.32)`; background `rgba(63,185,80,.08)` |
| Alert lead | mono, weight 700, 13px, `color-ok` |
| Alert body | 13px, `color-tx2`; `<b>` → `color-tx` |
| Timeline rail | left border 2px `color-line`; step padding `0 0 16px 22px` |
| Step dots | 14×14 hollow, border 2px `color-ok`, fill `color-bg` |
| End dot | 16×16 filled `color-ok` |
| Status (`✓ …`) | mono 11px, `color-ok` |
| RULE/EVIDENCE prefix | width ~66px, `color-tx3`, not bold |
| Rule/evidence value | 12.5px, `color-tx`, tight line-height 1.5 |
| Conclusion | 13.5px, weight 600, `color-ok` |

## Implementation outline

1. In `ResolvedDrawer.tsx`, restyle alert + timeline + conclusion with Tailwind utilities (no `.rec` / `.tl` / `.step` / `.dot` / `.st` / `.pfx` / `.ln` / `.concl` on those nodes).
2. Remove unused matching rules from `virtual_agents/style.css` only if no other file in the module still depends on them.
3. Keep behavior tests covering drawer content; add a narrow assertion only if useful for regression on visible status/lead text (no pixel tests).

## Testing

- Existing Resolved-drawer / monitor tests continue to pass (content still present).
- Manual check: open Resolved drawer for `iss_004` side-by-side with sample — green alert, green dots/status, compact RULE/EVIDENCE.

## Success criteria

Side-by-side with sample Resolved drawer for the same ticket: alert tint, timeline markers/status color, and how-it-got-there typography match within normal browser rounding.
