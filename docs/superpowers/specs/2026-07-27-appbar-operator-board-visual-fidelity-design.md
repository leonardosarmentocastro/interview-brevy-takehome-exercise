# Appbar + operator board visual fidelity

**Date:** 2026-07-27  
**Status:** approved  
**Scope:** `apps/web` — shared appbar + operator board

## Problem

Side-by-side / product review of the React rewrite:

1. **Appbar** looks like a card (background + border) instead of sitting flush on the page.
2. **Operator board** appbar lacks a purpose description (monitor already has one).
3. **“Virtual agent — today”** (`AgentSummary`) duplicates stats already on the virtual-agent monitor.
4. On the in-review **Dispute · item not received** card:
   - “Escalate to specialist” action uses the green `.cbtn.go` style; should read as escalate (red).
   - “Open ticket” label is not vertically centered in the button.
   - “▲ RECOMMEND ESCALATE TO SPECIALIST” sits in a red bordered/filled chip; should be red text only with stronger type.

## Goal

Flatten the appbar, add operator description copy, remove the duplicate agent summary from the operator board, and fix escalate/open affordances on operator issue cards.

## Non-goals

- Specialist board description (unless added later)
- Changes to `sample/`
- Monitor page content beyond shared appbar chrome
- Deleting `AgentSummary.tsx` / fixtures (stop rendering only; cleanup optional)

## Decisions

**Operator description copy (approved):**  
“Human review queue for cases the virtual agent couldn’t close. Claim a card, act on it, or escalate to a specialist.”

**Appbar chrome:** Remove `background` and `border` from `.appbar` (all routes that show the appbar). Keep padding, radius optional-off, and layout.

**Escalate card action:** When recommended action is an escalate (`why.face === "escalate"`), use a red button variant (e.g. `.cbtn.esc`), not `.cbtn.go`.

**Escalate why chip:** Strip `.chip.esc` border/background; keep red text; increase size/weight (~11px / 700 mono).

**Open ticket:** Make `.cbtn` a flex centering box so label is vertically/horizontally centered.

## Approach

Targeted CSS + small component edits (same pattern as recent visual fixes):

| Change | File(s) |
|---|---|
| Flatten appbar | `shared/ui/style.css` |
| Operator description | `AppHeader.tsx` `HEADERS` |
| Remove AgentSummary from board | `OperatorBoardPage.tsx` |
| Red escalate button + chip type | `IssueCard.tsx`, `operators/style.css` |
| `.cbtn` alignment | `operators/style.css` |

## Testing

- AppHeader: operator route shows the new description; monitor description unchanged.
- ConsoleFrame / AppHeader: appbar still renders where expected (drill still hidden).
- OperatorBoardPage: no “Virtual agent — today” heading.
- IssueCard: escalate recommendation text present; escalate action uses esc/red class (not `go`); Open ticket still present.
- Existing operator board / IssueCard tests updated as needed.

## Success criteria

Appbar has no card chrome; operator header has the approved description; agent summary strip gone from operator board; iss_003-style card shows red escalate CTA, centered Open ticket, and unboxed red recommend text.
