# Appbar + operator board visual fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten the shared appbar, add the operator board description, remove the duplicate Virtual-agent-today strip from the operator board, and fix escalate/open affordances on operator issue cards.

**Architecture:** Shared appbar chrome in `shared/ui`; operator board page stops rendering `AgentSummary`; issue-card escalate styling via `why.face` + CSS variants.

**Tech Stack:** Next 16, React 19, Vitest + Testing Library, existing module CSS.

**Design spec:** `docs/superpowers/specs/2026-07-27-appbar-operator-board-visual-fidelity-design.md`

## Global Constraints

- **Branch:** `fix/appbar-operator-visual` (already created). Do not commit to `main`.
- **TDD mandatory:** red → green → refactor; one vertical slice per commit.
- **Test location:** `__tests__/` beside the unit under test.
- **Test runner (from `apps/web/`):** `pnpm exec vitest run <path>`; whole app `pnpm test`.
- **Scope:** appbar + operator board only. Do not change sample/, specialist description, or drill hide-appbar behavior.
- **Operator description copy (verbatim):** `Human review queue for cases the virtual agent couldn’t close. Claim a card, act on it, or escalate to a specialist.`
- **Keep plan Global Constraints aligned with root `AGENTS.md`.**

## File Structure

```
apps/web/src/
  shared/ui/
    style.css                              # flatten .appbar
    components/AppHeader.tsx               # operator description
    components/__tests__/AppHeader.test.tsx
  modules/operators/
    pages/OperatorBoardPage.tsx            # remove AgentSummary
    pages/__tests__/OperatorBoardPage.test.tsx
    components/IssueCard.tsx               # cbtn.esc when escalate
    components/__tests__/IssueCard.test.tsx
    style.css                              # .chip.esc, .cbtn, .cbtn.esc
```

---

### Task 1: Flatten appbar + operator description

**Files:**
- Modify: `apps/web/src/shared/ui/style.css`
- Modify: `apps/web/src/shared/ui/components/AppHeader.tsx`
- Modify: `apps/web/src/shared/ui/components/__tests__/AppHeader.test.tsx`

**Interfaces:**
- Produces: operator `HEADERS` entry includes `description` string (verbatim above); `.appbar` has no `background` / `border`

- [ ] **Step 1: Update AppHeader tests (failing)**

Replace the last test and add an operator description test. Change `"omits the machine badge and monitor description on other views"` to still assert no machine badge / no *monitor* description on operators, and add:

```tsx
  it("shows the operator board description", () => {
    path = "/boards/operators";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(
      screen.getByText(
        /Human review queue for cases the virtual agent couldn’t close/i,
      ),
    ).toBeInTheDocument();
  });
```

Keep the existing test that operators omit the machine badge and the virtual-agent description text.

Also add a CSS contract check (same pattern as drill-styles) **or** assert via reading `style.css` in a tiny test. Prefer extending AppHeader tests for copy and a small stylesheet test:

Create `apps/web/src/shared/ui/__tests__/appbar-styles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../style.css"), "utf8");

describe("appbar styles", () => {
  it("does not paint .appbar as a bordered card", () => {
    const block = css.match(/\.appbar\s*\{[^}]+\}/)?.[0] ?? "";
    expect(block).not.toMatch(/background:/);
    expect(block).not.toMatch(/border:/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/web && pnpm exec vitest run \
  src/shared/ui/components/__tests__/AppHeader.test.tsx \
  src/shared/ui/__tests__/appbar-styles.test.ts
```

- [ ] **Step 3: Implement**

In `AppHeader.tsx`, set operators entry to:

```tsx
  {
    match: "/boards/operators",
    layer: 2,
    title: "Operator board — for human review",
    description:
      "Human review queue for cases the virtual agent couldn’t close. Claim a card, act on it, or escalate to a specialist.",
  },
```

In `shared/ui/style.css`, change `.appbar` to remove background and border:

```css
.appbar {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 10px 14px;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Run — expect PASS**, then commit

```bash
git add apps/web/src/shared/ui/style.css \
  apps/web/src/shared/ui/components/AppHeader.tsx \
  apps/web/src/shared/ui/components/__tests__/AppHeader.test.tsx \
  apps/web/src/shared/ui/__tests__/appbar-styles.test.ts
git commit -m "$(cat <<'EOF'
fix(web): flatten appbar and add operator description

EOF
)"
```

---

### Task 2: Remove Virtual agent — today from operator board

**Files:**
- Modify: `apps/web/src/modules/operators/pages/OperatorBoardPage.tsx`
- Modify: `apps/web/src/modules/operators/pages/__tests__/OperatorBoardPage.test.tsx`

**Interfaces:**
- Produces: board page no longer imports/renders `AgentSummary`

- [ ] **Step 1: Failing test**

Add to `OperatorBoardPage.test.tsx`:

```tsx
  it("does not render the Virtual agent — today summary", () => {
    render(<OperatorBoardPage />);
    expect(
      screen.queryByRole("heading", { name: /Virtual agent — today/i }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run — expect FAIL** (heading currently present)

- [ ] **Step 3: Remove `<AgentSummary />` and unused import / `agentSummary` destructure**

```tsx
  const { columns } = data;

  return (
    <main data-testid="screen-operator">
      <div className="twozone">
        ...
```

Leave `AgentSummary.tsx` in the repo (unused is fine for this task).

- [ ] **Step 4: PASS + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(web): drop Virtual agent today strip from operator board

EOF
)"
```

---

### Task 3: Escalate chip/button + Open ticket alignment

**Files:**
- Modify: `apps/web/src/modules/operators/components/IssueCard.tsx`
- Modify: `apps/web/src/modules/operators/style.css`
- Modify: `apps/web/src/modules/operators/components/__tests__/IssueCard.test.tsx`

**Interfaces:**
- Produces: when `dec?.why?.face === "escalate"` and `rec` exists, action class is `cbtn esc` (not `go`); `.chip.esc` is text-only red; `.cbtn` is flex-centered

- [ ] **Step 1: Failing IssueCard test**

Extend fixture with escalate decision + recommended action; assert:

```tsx
  it("styles escalate recommendation and CTA in red, not green go", () => {
    const escalateVm = {
      ...vm,
      decision: {
        why: {
          face: "escalate",
          lead: "▲ RECOMMEND ESCALATE TO SPECIALIST",
          because: "…",
          ref: 53,
        },
        actions: {
          recommended: { label: "▲ Escalate to specialist", sub: "amount over $200" },
          others: [],
        },
        urgency: { level: "soon", label: "⏱ carrier ETA Jan 14" },
      },
    } as unknown as IssueViewModel;

    const { container } = render(<IssueCard vm={escalateVm} />);
    expect(
      screen.getByText(/RECOMMEND ESCALATE TO SPECIALIST/i),
    ).toBeInTheDocument();
    const escBtn = screen.getByText(/^Escalate to specialist$/);
    expect(escBtn.className).toMatch(/\besc\b/);
    expect(escBtn.className).not.toMatch(/\bgo\b/);
    expect(container.querySelector(".chip.esc")).not.toBeNull();
  });
```

- [ ] **Step 2: Run — expect FAIL** (button currently has `go`)

- [ ] **Step 3: Implement IssueCard**

```tsx
        {rec ? (
          <span
            className={`cbtn ${dec?.why?.face === "escalate" ? "esc" : "go"}`}
          >
            {rec.label.replace(/^[▲✓◆]\s*/, "")}
          </span>
        ) : (
```

Update CSS:

```css
.chip.esc {
  background: none;
  color: var(--color-bad);
  border: none;
  padding: 0;
  margin-top: 9px;
  font: 700 11px var(--font-mono);
  letter-spacing: 0.3px;
}
.cbtn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: 600 11px var(--font-mono);
  padding: 7px;
  border-radius: 7px;
  border: 1px solid var(--color-line);
  background: var(--color-col);
  color: var(--color-tx3);
  cursor: pointer;
  text-align: center;
}
.cbtn.esc {
  border-color: rgba(248, 81, 73, 0.5);
  color: var(--color-bad);
  background: rgba(248, 81, 73, 0.08);
}
```

Keep `.cbtn.go` as-is for non-escalate recommends.

- [ ] **Step 4: PASS full `pnpm test` + commit**

```bash
git commit -m "$(cat <<'EOF'
fix(web): red escalate CTA and unboxed recommend text on cards

EOF
)"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| Flatten appbar | 1 |
| Operator description | 1 |
| Remove AgentSummary from board | 2 |
| Red escalate button | 3 |
| Open ticket vertical align | 3 |
| Unboxed escalate chip type | 3 |
