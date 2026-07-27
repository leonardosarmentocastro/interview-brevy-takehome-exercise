# Auto-resolved drill page visual fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the sample auto-resolved drill screen: no appbar, bold “Auto-resolved” title, full-width subtitle, green policy links in the Rule fired column and pattern callout.

**Architecture:** Hide `AppHeader` on the drill route inside `ConsoleFrame` (sample’s `showDrill` omits the appbar). Fix title/subtitle and green plinks via small CSS updates in `virtual_agents/style.css` (same selectors as sample).

**Tech Stack:** Next 16 App Router, React 19, Vitest + Testing Library, existing module CSS + `PolicyLink`.

**Design spec:** `docs/superpowers/specs/2026-07-27-drill-page-visual-fidelity-design.md`

## Global Constraints

- **Branch:** implement on `fix/drill-page-visual` (already created from `main`). Do not commit to `main`.
- **TDD mandatory:** red → green → refactor; one vertical slice per commit.
- **Test location:** `__tests__/` beside the unit under test.
- **Test runner (from `apps/web/`):** `pnpm exec vitest run <path>`; whole app `pnpm test`.
- **Scope:** drill route + drill page styles only. Do not change monitor page appbar content, operators/specialists, or global `.plink` default outside `.tbl td.rule` / `.pattern`.
- **Keep plan Global Constraints aligned with root `AGENTS.md`.**

## File Structure

```
apps/web/src/
  shared/ui/components/
    ConsoleFrame.tsx                 # modify: skip AppHeader on drill
    __tests__/
      ConsoleFrame.test.tsx          # create (or extend): appbar presence by path
    AppHeader.tsx                    # unchanged (still used on other routes)
  modules/virtual_agents/
    style.css                        # modify: .head h1, .sub, .plink greens
    pages/DrillPage.tsx              # unchanged markup (uses .sub / .pattern)
    components/DrillTable.tsx        # unchanged markup (td.rule > PolicyLink)
    pages/__tests__/DrillPage.test.tsx  # extend: subtitle + pattern plink
```

---

### Task 1: Hide appbar on drill route

**Files:**
- Create: `apps/web/src/shared/ui/components/__tests__/ConsoleFrame.test.tsx`
- Modify: `apps/web/src/shared/ui/components/ConsoleFrame.tsx`

**Interfaces:**
- Consumes: `usePathname` from `next/navigation`; existing `AppHeader`, `PipelineNav`, `RoleModal`, `PolicyModal`
- Produces: `ConsoleFrame` renders children + nav always; renders `AppHeader` only when pathname is **not** `/monitors/agents/drill`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/shared/ui/components/__tests__/ConsoleFrame.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";

let path = "/monitors/agents";
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: vi.fn() }),
}));

import { ConsoleFrame } from "@/shared/ui/components/ConsoleFrame";

function wrap(pathValue: string) {
  path = pathValue;
  return render(
    <JotaiProvider>
      <ConsoleFrame>
        <div data-testid="child">child</div>
      </ConsoleFrame>
    </JotaiProvider>,
  );
}

describe("ConsoleFrame", () => {
  it("shows the virtual-agent appbar on the monitor route", () => {
    wrap("/monitors/agents");
    expect(
      screen.getByRole("heading", { name: /Virtual agent — pipeline monitor/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("hides the appbar on the auto-resolved drill route", () => {
    wrap("/monitors/agents/drill");
    expect(
      screen.queryByRole("heading", {
        name: /Virtual agent — pipeline monitor/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch role/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm exec vitest run src/shared/ui/components/__tests__/ConsoleFrame.test.tsx
```

Expected: FAIL on the drill case — appbar still present.

- [ ] **Step 3: Implement**

In `ConsoleFrame.tsx`, skip `AppHeader` on the drill path:

```tsx
"use client";
import { useAtom } from "jotai";
import { usePathname } from "next/navigation";
import { roleAtom } from "../data/atoms/role";
import { AppHeader } from "./AppHeader";
import { PipelineNav } from "./PipelineNav";
import { RoleModal } from "./RoleModal";
import { PolicyModal } from "@/shared/policies/components/PolicyModal";
import type { ReactNode } from "react";
import "../style.css";

export function ConsoleFrame({ children }: { children: ReactNode }) {
  const [role, setRole] = useAtom(roleAtom);
  const pathname = usePathname();
  const hideAppbar = pathname === "/monitors/agents/drill";
  return (
    <>
      <div className="wrap">
        {hideAppbar ? null : (
          <AppHeader onSwitchRole={() => setRole(null)} />
        )}
        {children}
        <PipelineNav />
      </div>
      <RoleModal open={role === null} onPick={(r) => setRole(r)} />
      <PolicyModal />
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm exec vitest run src/shared/ui/components/__tests__/ConsoleFrame.test.tsx src/shared/ui/components/__tests__/AppHeader.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/web/src/shared/ui/components/ConsoleFrame.tsx \
  apps/web/src/shared/ui/components/__tests__/ConsoleFrame.test.tsx
git commit -m "$(cat <<'EOF'
fix(web): hide appbar on auto-resolved drill route

EOF
)"
```

---

### Task 2: Title weight, subtitle width, green policy links

**Files:**
- Modify: `apps/web/src/modules/virtual_agents/style.css`
- Modify: `apps/web/src/modules/virtual_agents/pages/__tests__/DrillPage.test.tsx`

**Interfaces:**
- Consumes: existing DrillPage / DrillTable markup (`.head h1`, `.sub`, `.tbl td.rule`, `.pattern`)
- Produces: CSS contract matching sample monitor drill styles

- [ ] **Step 1: Extend DrillPage test (failing style contract)**

Append to `DrillPage.test.tsx`:

```tsx
  it("uses full-width subtitle and green rule/pattern policy links", () => {
    const { container } = render(<DrillPage />);

    const sub = container.querySelector("p.sub");
    expect(sub).not.toBeNull();
    expect(sub?.className).not.toMatch(/max-w/);
    // Contract: module CSS must not constrain .sub (assert stylesheet text)
    // Prefer DOM: rule cell plink exists; green comes from CSS — assert class chain
    const ruleCell = container.querySelector("td.rule .plink");
    expect(ruleCell).not.toBeNull();

    const patternLink = container.querySelector(".pattern .plink");
    expect(patternLink).not.toBeNull();
  });
```

Also add a focused CSS-contract test file (cleaner than parsing CSS from the page test):

Create `apps/web/src/modules/virtual_agents/__tests__/drill-styles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(__dirname, "../style.css"),
  "utf8",
);

describe("virtual_agents drill styles", () => {
  it("bolds .head h1, drops .sub max-width, greens rule/pattern plinks", () => {
    expect(css).toMatch(/\.head h1\s*\{[^}]*font-weight:\s*700/);
    expect(css).not.toMatch(/\.sub\s*\{[^}]*max-width:\s*720px/);
    expect(css).toMatch(/\.tbl td\.rule \.plink\s*\{[^}]*color:\s*var\(--color-ok\)/);
    expect(css).toMatch(/\.pattern \.plink\s*\{[^}]*color:\s*var\(--color-ok\)/);
  });
});
```

Keep the DrillPage DOM assertions for `.sub` / `.plink` presence; the CSS file test owns the visual contract.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm exec vitest run \
  src/modules/virtual_agents/__tests__/drill-styles.test.ts \
  src/modules/virtual_agents/pages/__tests__/DrillPage.test.tsx
```

Expected: FAIL — CSS file missing bold / still has max-width / missing green plink rules. DrillPage presence assertions may already pass.

- [ ] **Step 3: Update `style.css`**

Change:

```css
.head h1 { font-size: 18px; margin: 0; }
```

to:

```css
.head h1 { font-size: 18px; font-weight: 700; margin: 0; }
```

Change `.sub` from:

```css
.sub { font-size: 13px; color: var(--color-tx2); margin: 0 0 16px; line-height: 1.5; max-width: 720px; }
```

to:

```css
.sub { font-size: 13px; color: var(--color-tx2); margin: 0 0 16px; line-height: 1.5; }
```

After `.tbl td.rule { ... }` add:

```css
.tbl td.rule .plink { color: var(--color-ok); }
.tbl td.rule .plink:hover { color: #56d364; }
```

Inside/near `.pattern` rules add:

```css
.pattern .plink { color: var(--color-ok); }
.pattern .plink:hover { color: #56d364; }
```

(Sample uses ok for rule plinks; `#56d364` is a slightly lighter green hover — if sample has no hover override, omit hover and keep default plink hover only when not overridden. Prefer matching sample: only set `color: var(--color-ok)` if sample lacks a hover rule.)

Sample only has:

```css
.tbl td.rule .plink{color:var(--ok)}
```

So implement **color only** (no custom hover) for both `.tbl td.rule .plink` and `.pattern .plink`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm exec vitest run \
  src/modules/virtual_agents/__tests__/drill-styles.test.ts \
  src/modules/virtual_agents/pages/__tests__/DrillPage.test.tsx
```

Expected: PASS.

Also:

```bash
cd apps/web && pnpm test
```

Expected: all green.

- [ ] **Step 5: Manual check**

Open `/monitors/agents/drill` — no appbar; bold title; subtitle spans width; green `policies.md:N` in Rule fired + pattern box.

- [ ] **Step 6: Commit**

```bash
git add \
  apps/web/src/modules/virtual_agents/style.css \
  apps/web/src/modules/virtual_agents/__tests__/drill-styles.test.ts \
  apps/web/src/modules/virtual_agents/pages/__tests__/DrillPage.test.tsx
git commit -m "$(cat <<'EOF'
fix(web): drill title, subtitle width, and green policy links

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Hide whole appbar on drill | Task 1 |
| Bold Auto-resolved title | Task 2 |
| Remove .sub max-width | Task 2 |
| Green Rule fired + pattern plinks | Task 2 |
| Out of scope: monitor header, other boards | Not tasked |
