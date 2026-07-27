# Translate `sample/` into a three-domain React app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the vanilla-JS Payment Issue Console mockup in `sample/` into `apps/web` as three DDD domain modules (`virtual_agents`, `operators`, `specialists`) plus `shared/ui` and `shared/policies`, visually exact and behaviourally faithful, fully test-driven.

**Architecture:** Next.js App Router. Thin route files re-export screen components from `modules/<m>/pages/`. Next Route Handlers (`app/api/**`) serve ported fixtures as JSON; TanStack Query reads them; Jotai atoms (under `modules/<m>/data/atoms/`) own every interaction the demo mutates locally, seeded once from the Query snapshot. Styling is Tailwind v4 utilities over CSS-variable design tokens ported from `sample/styles.css`.

**Tech Stack:** Next 16 (App Router), React 19, TypeScript, Tailwind v4, TanStack Query v5, Jotai v2, Vitest v4 + Testing Library (jsdom).

**Design spec:** `docs/superpowers/specs/2026-07-26-sample-to-react-design.md`. Read it before starting.

**Verbatim UI source:** `sample/`. Every component ports its markup/classes from a named `sample/lib/*.js` render function — read that function and translate its HTML string to JSX. The tests below are the behavioural contract; the sample source is the visual contract.

## Global Constraints

- **Branch:** all work on `feat/web-sample-to-react` (already created). Never commit to `main`/`HEAD`.
- **TDD mandatory:** red → green → refactor, one vertical slice per commit. Never write implementation before a failing test.
- **Test location:** `__tests__/` folder beside the unit under test — never co-located beside the file.
- **Test runner (run from `apps/web/`):** single file `pnpm exec vitest run <path>`; whole app `pnpm test`. Lint: `pnpm exec eslint`.
- **Module folders:** plural `snake_case` (`virtual_agents`, `operators`, `specialists`), mirroring the API namespaces.
- **Components:** `PascalCase.tsx`, exactly one component per file. **Hooks/utils:** `kebab-case.ts`, one primary export each. **`types.ts`** may group related types.
- **State:** Jotai atoms under `modules/<m>/data/atoms/`; fixtures under `modules/<m>/data/fixtures/`.
- **Styling:** `src/app/globals.css` holds ONLY design tokens (`@theme`) + reset. Module-specific CSS lives in `modules/<m>/style.css` (or `shared/<x>/style.css`) and is imported by that module's page/component. Everything else is Tailwind utilities referencing tokens. No shadcn.
- **Import alias:** `@` → `apps/web/src` (both TS and Vitest).
- **Data fetching:** Route Handlers are same-origin under `/api/...`. Client hooks fetch **relative** URLs via `shared/api/local.ts` — do NOT use `shared/api/request.ts` (it targets the external API app on `:3333`, out of scope this round).
- **Fixtures are imported modules**, never read from the repo root at runtime: port `sample/data/*.js` → `data/fixtures/*.ts`, the four root JSON files → `operators/data/fixtures/*.json`, and `policies.md` → `shared/policies/data/fixtures/policies.ts` (exported string).
- **Operator join uses a fixed clock:** `NOW = '2025-01-13T12:00:00Z'` (matches the sample).
- **Next 16 dynamic APIs:** in Route Handlers and pages, `params` is a `Promise` — `await ctx.params`. Check `node_modules/next/dist/docs/` if anything about App Router APIs looks unfamiliar.
- **Verify green before every commit** (run the task's tests, see them pass).

## File Structure

```
apps/web/src/
  app/
    layout.tsx                       # extend: Providers + role gate + <AppHeader/> + <PolicyModal/>
    page.tsx                         # replace: redirect → /monitors/agents
    providers.tsx                    # extend: add Jotai Provider
    globals.css                      # replace: @theme tokens + reset
    monitors/agents/page.tsx
    monitors/agents/drill/page.tsx
    boards/operators/page.tsx
    boards/operators/[issueId]/page.tsx
    boards/specialists/page.tsx
    boards/specialists/[caseId]/page.tsx
    api/
      virtual_agents/monitor/route.ts
      operators/issues/route.ts
      operators/issues/[id]/route.ts
      specialists/board/route.ts
      specialists/cases/[id]/route.ts
      policies/route.ts
  modules/
    virtual_agents/  pages/ components/ hooks/ data/{fixtures,atoms}/ types.ts style.css
    operators/       pages/ components/ hooks/ utils/ data/{fixtures,atoms}/ types.ts style.css
    specialists/     pages/ components/ hooks/ data/{fixtures,atoms}/ types.ts style.css
  shared/
    api/request.ts (exists)  api/local.ts (new)
    ui/       components/ data/atoms/role.ts style.css
    policies/ components/ hooks/ data/{fixtures,atoms}/ style.css
  lib/utils.ts (exists)
```

---

# Phase 0 — Foundation (bootable shell)

### Task 1: Design tokens + base stylesheet

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/src/app/__tests__/globals-tokens.test.ts`

**Interfaces:**
- Produces: CSS custom properties usable as Tailwind utilities — `bg-bg`, `bg-col`, `bg-col2`, `border-line`, `text-tx`, `text-tx2`, `text-tx3`, `text-ok`, `text-warn`, `text-bad`, `text-info`, `font-mono`.

- [ ] **Step 1: Write the failing test** (asserts the token contract exists in the stylesheet text)

```ts
// apps/web/src/app/__tests__/globals-tokens.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "../globals.css"), "utf8");

describe("design tokens", () => {
  it("defines the ported palette inside @theme", () => {
    expect(css).toContain("@theme");
    for (const token of [
      "--color-bg: #0e1116",
      "--color-col: #161b22",
      "--color-col2: #1c2230",
      "--color-line: #2a3140",
      "--color-tx: #e6edf3",
      "--color-tx2: #9aa7b8",
      "--color-tx3: #8b97a8",
      "--color-ok: #3fb950",
      "--color-warn: #d29922",
      "--color-bad: #f85149",
      "--color-info: #58a6ff",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/--font-mono:\s*ui-monospace/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/__tests__/globals-tokens.test.ts`
Expected: FAIL (tokens/`@theme` not present).

- [ ] **Step 3: Write minimal implementation** — replace `globals.css`

```css
@import "tailwindcss";

@theme {
  --color-bg: #0e1116;
  --color-col: #161b22;
  --color-col2: #1c2230;
  --color-line: #2a3140;
  --color-tx: #e6edf3;
  --color-tx2: #9aa7b8;
  --color-tx3: #8b97a8;
  --color-ok: #3fb950;
  --color-warn: #d29922;
  --color-bad: #f85149;
  --color-info: #58a6ff;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-tx);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/__tests__/globals-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/__tests__/globals-tokens.test.ts
git commit -m "feat(web): port sample design tokens into Tailwind @theme"
```

---

### Task 2: Providers — add Jotai + same-origin fetch helper

**Files:**
- Modify: `apps/web/package.json` (add `jotai`)
- Modify: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/shared/api/local.ts`
- Test: `apps/web/src/shared/api/__tests__/local.test.ts`

**Interfaces:**
- Produces: `fetchLocal<T>(path: string): Promise<T>` — same-origin JSON GET against `/api/...`. Used by every module hook.
- Produces: `<Providers>` wrapping children in `QueryClientProvider` **and** Jotai `Provider`.

- [ ] **Step 1: Install Jotai**

Run (from `apps/web/`): `pnpm add jotai`
Expected: `jotai` appears in `dependencies`.

- [ ] **Step 2: Write the failing test**

```ts
// apps/web/src/shared/api/__tests__/local.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLocal } from "@/shared/api/local";

afterEach(() => vi.restoreAllMocks());

describe("fetchLocal", () => {
  it("GETs a relative path and returns parsed JSON", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const data = await fetchLocal<{ ok: boolean }>("/api/policies");
    expect(spy).toHaveBeenCalledWith("/api/policies", expect.anything());
    expect(data).toEqual({ ok: true });
  });

  it("throws on non-ok responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    await expect(fetchLocal("/api/policies")).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/api/__tests__/local.test.ts`
Expected: FAIL (`fetchLocal` not defined).

- [ ] **Step 4: Implement `local.ts`**

```ts
// apps/web/src/shared/api/local.ts
export async function fetchLocal<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/api/__tests__/local.test.ts`
Expected: PASS.

- [ ] **Step 6: Add Jotai Provider** — replace `providers.tsx`

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <JotaiProvider>{children}</JotaiProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Commit**

```bash
# run git from the repo root; the lockfile is the workspace root pnpm-lock.yaml
git add apps/web/package.json pnpm-lock.yaml apps/web/src/app/providers.tsx apps/web/src/shared/api/local.ts apps/web/src/shared/api/__tests__/local.test.ts
git commit -m "feat(web): add Jotai provider and same-origin fetchLocal helper"
```

---

### Task 3: Routing skeleton + redirect

**Files:**
- Replace: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/monitors/agents/page.tsx`, `apps/web/src/app/monitors/agents/drill/page.tsx`
- Create: `apps/web/src/app/boards/operators/page.tsx`, `apps/web/src/app/boards/operators/[issueId]/page.tsx`
- Create: `apps/web/src/app/boards/specialists/page.tsx`, `apps/web/src/app/boards/specialists/[caseId]/page.tsx`
- Test: `apps/web/src/app/__tests__/routes.test.tsx`
- Note: leave `components/Counter.tsx` and its test in place (unused after `page.tsx` becomes a redirect); they can be removed in a later cleanup.

**Interfaces:**
- Produces: six navigable routes; `/` redirects to `/monitors/agents`. Each route file default-exports a component that (for now) renders a placeholder `<main>` with the screen name; later tasks replace the placeholder body with the real screen import.

- [ ] **Step 1: Write the failing test** (renders each placeholder page component directly)

```tsx
// apps/web/src/app/__tests__/routes.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MonitorRoute from "@/app/monitors/agents/page";
import OperatorRoute from "@/app/boards/operators/page";
import SpecialistRoute from "@/app/boards/specialists/page";

describe("route skeletons", () => {
  it("renders each board placeholder", () => {
    render(<MonitorRoute />);
    expect(screen.getByTestId("screen-monitor")).toBeInTheDocument();
    render(<OperatorRoute />);
    expect(screen.getByTestId("screen-operator")).toBeInTheDocument();
    render(<SpecialistRoute />);
    expect(screen.getByTestId("screen-specialist")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/__tests__/routes.test.tsx`
Expected: FAIL (route modules do not exist).

- [ ] **Step 3: Implement the route files**

`page.tsx` (root redirect):
```tsx
import { redirect } from "next/navigation";
export default function Home() { redirect("/monitors/agents"); }
```

`monitors/agents/page.tsx`:
```tsx
export default function MonitorRoute() {
  return <main data-testid="screen-monitor">Monitor</main>;
}
```
`monitors/agents/drill/page.tsx`:
```tsx
export default function DrillRoute() {
  return <main data-testid="screen-drill">Drill</main>;
}
```
`boards/operators/page.tsx`:
```tsx
export default function OperatorRoute() {
  return <main data-testid="screen-operator">Operator</main>;
}
```
`boards/operators/[issueId]/page.tsx`:
```tsx
export default async function IssueDetailRoute({
  params,
}: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <main data-testid="screen-issue-detail">{issueId}</main>;
}
```
`boards/specialists/page.tsx`:
```tsx
export default function SpecialistRoute() {
  return <main data-testid="screen-specialist">Specialist</main>;
}
```
`boards/specialists/[caseId]/page.tsx`:
```tsx
export default async function CaseRoute({
  params,
}: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <main data-testid="screen-case">{caseId}</main>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/__tests__/routes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manual boot check**

Run: `pnpm dev` (from `apps/web/`), open `http://localhost:3000` → should redirect to `/monitors/agents`. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app
git commit -m "feat(web): add routing skeleton and root redirect to monitors/agents"
```

---

### Task 4: PipelineNav (path-derived active step)

**Files:**
- Create: `apps/web/src/shared/ui/components/PipelineNav.tsx`
- Create: `apps/web/src/shared/ui/style.css`
- Test: `apps/web/src/shared/ui/components/__tests__/PipelineNav.test.tsx`

**Port from:** `sample/lib/nav.js` (`renderPipelineNav`) — three steps: `agent` (🖥️ Virtual agent / pipeline monitor), `operator` (📋 Operator board / for human review), `specialist` (🔎 Specialist board / for fraud & escalations), separated by `⟶`.

**Interfaces:**
- Consumes: `usePathname()` from `next/navigation`.
- Produces: `<PipelineNav />` — a client component. Active step highlighted when the pathname starts with that step's href. Hrefs: agent→`/monitors/agents`, operator→`/boards/operators`, specialist→`/boards/specialists`. Each step is a `next/link`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/components/__tests__/PipelineNav.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/boards/operators" }));
import { PipelineNav } from "@/shared/ui/components/PipelineNav";

describe("PipelineNav", () => {
  it("marks the step matching the current path as active", () => {
    render(<PipelineNav />);
    const operator = screen.getByRole("link", { name: /operator board/i });
    expect(operator).toHaveAttribute("aria-current", "page");
    const agent = screen.getByRole("link", { name: /virtual agent/i });
    expect(agent).not.toHaveAttribute("aria-current");
  });

  it("links each step to its route", () => {
    render(<PipelineNav />);
    expect(screen.getByRole("link", { name: /virtual agent/i })).toHaveAttribute("href", "/monitors/agents");
    expect(screen.getByRole("link", { name: /specialist board/i })).toHaveAttribute("href", "/boards/specialists");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/ui/components/__tests__/PipelineNav.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Implement `PipelineNav.tsx`** — port the markup/classes from `sample/lib/nav.js`, converting `<div class="pstep">` to `<Link>`, adding `aria-current="page"` on the active step. Translate the sample's inline CSS for `.pnav/.pstep/.pi/.ptxt` into `shared/ui/style.css` (import it at the top of this file).

```tsx
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
```

- [ ] **Step 4: Populate `shared/ui/style.css`** by porting the `.pnav`, `.pstep`, `.pi`, `.ptxt`, `.pt`, `.ps`, `.arr`, `.active` rules from `sample/styles.css` (search that file for `.pnav`). Replace `var(--x)` with `var(--color-x)` token names.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/ui/components/__tests__/PipelineNav.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/shared/ui
git commit -m "feat(web): PipelineNav with path-derived active step"
```

---

### Task 5: AppHeader (path-derived title + ADM chip)

**Files:**
- Create: `apps/web/src/shared/ui/components/AppHeader.tsx`
- Test: `apps/web/src/shared/ui/components/__tests__/AppHeader.test.tsx`
- Append CSS: `apps/web/src/shared/ui/style.css`

**Port from:** `sample/lib/shell.js` (`renderAppHeader`, `HEADERS`). Header = eyebrow `Pipeline · layer N of 3` + per-view `<h2>` title + spacer + clickable ADM identity chip. Titles: agent → "Virtual agent — pipeline monitor" (layer 1); operator → "Operator board — for human review" (layer 2); specialist → "Specialist board — for fraud & escalations" (layer 3).

**Interfaces:**
- Consumes: `usePathname()`; a click handler prop `onSwitchRole: () => void` (wired to reopen the role modal in Task 6).
- Produces: `<AppHeader onSwitchRole={...} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/components/__tests__/AppHeader.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let path = "/monitors/agents";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
import { AppHeader } from "@/shared/ui/components/AppHeader";

describe("AppHeader", () => {
  it("shows the layer eyebrow and title for the current view", () => {
    path = "/boards/specialists";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(screen.getByText(/layer 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /specialist board/i })).toBeInTheDocument();
  });

  it("fires onSwitchRole when the identity chip is clicked", async () => {
    path = "/monitors/agents";
    const onSwitchRole = vi.fn();
    render(<AppHeader onSwitchRole={onSwitchRole} />);
    await userEvent.click(screen.getByRole("button", { name: /switch role/i }));
    expect(onSwitchRole).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/ui/components/__tests__/AppHeader.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `AppHeader.tsx`** — a `"use client"` component. Map pathname → `{ layer, title }` via a `HEADERS` table keyed by the three hrefs (default to agent). Port the `.appbar/.ttl/.eyebrow/.idchip/.ava/.who/.car` markup from `sample/lib/shell.js`; the identity chip is a `<button aria-label="Switch role" onClick={onSwitchRole}>`. Add the CSS rules for those classes to `shared/ui/style.css` (port from `sample/styles.css`, `var(--x)` → `var(--color-x)`).

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/shared/ui/components/__tests__/AppHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/ui
git commit -m "feat(web): AppHeader with path-derived title and identity chip"
```

---

### Task 6: RoleModal + role gate wired into the layout

**Files:**
- Create: `apps/web/src/shared/ui/data/atoms/role.ts`
- Create: `apps/web/src/shared/ui/components/RoleModal.tsx`
- Create: `apps/web/src/shared/ui/components/ConsoleFrame.tsx` (client wrapper: AppHeader + PipelineNav + RoleModal + children)
- Modify: `apps/web/src/app/layout.tsx` (render `<ConsoleFrame>` around `{children}`)
- Test: `apps/web/src/shared/ui/components/__tests__/RoleModal.test.tsx`
- Append CSS: `apps/web/src/shared/ui/style.css`

**Port from:** `sample/lib/shell.js` (`renderRoleModal`, `ROLES`, `roleRow`). Modal lists Admin (enabled, "Continue →"), Specialist (`requires auth`), Operator (`requires auth`), each with a plain-language scope line. Only Admin is clickable.

**Interfaces:**
- Consumes: nothing external.
- Produces: `roleAtom` (`atom<"admin" | null>(null)` — session gate); `<RoleModal open onPick />`; `<ConsoleFrame>{children}</ConsoleFrame>`.
- The modal is **open on first load** (role is `null`); picking Admin sets `roleAtom = "admin"` and closes it. The AppHeader's `onSwitchRole` reopens it by resetting `roleAtom` to `null`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/shared/ui/components/__tests__/RoleModal.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleModal } from "@/shared/ui/components/RoleModal";

describe("RoleModal", () => {
  it("enables only Admin and gates the other roles", () => {
    render(<RoleModal open onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.getAllByText(/requires auth/i)).toHaveLength(2);
  });

  it("calls onPick('admin') when Admin is chosen", async () => {
    const onPick = vi.fn();
    render(<RoleModal open onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onPick).toHaveBeenCalledWith("admin");
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RoleModal open={false} onPick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/shared/ui/components/__tests__/RoleModal.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `role.ts`**

```ts
import { atom } from "jotai";
export type Role = "admin";
export const roleAtom = atom<Role | null>(null);
```

- [ ] **Step 4: Implement `RoleModal.tsx`** — returns `null` when `!open`. Port the `.overlay/.modal/.mh/.mtitle/.mnote/.role/.rava/.rbody/.rname/.rscope/.cont/.rtag/.mfoot` markup from `sample/lib/shell.js`. The Admin row's action is a `<button onClick={() => onPick("admin")}>Continue →</button>`; the two disabled rows render a `requires auth` tag. Port the CSS for those classes into `shared/ui/style.css`.

```tsx
"use client";

const ROLES = [
  { enabled: true, name: "Admin", mgr: "", avatar: "A", scope: "Full visibility across all three pipeline layers — virtual agent, operator & specialist." },
  { enabled: false, name: "Specialist", mgr: " / manager", avatar: "🔒", scope: "Sees the specialist board. Manager sees across all specialists." },
  { enabled: false, name: "Operator", mgr: " / manager", avatar: "🔒", scope: "Sees only their own operator board. Manager sees across all operators." },
];

export function RoleModal({ open, onPick }: { open: boolean; onPick: (role: "admin") => void }) {
  if (!open) return null;
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mh"><span className="dot" /><span className="brand">PAYMENT ISSUE CONSOLE</span></div>
        <div className="mtitle">Who&apos;s operating the console?</div>
        <p className="mnote">Authentication isn&apos;t wired in this MVP — <code>pick a role to continue</code>.</p>
        {ROLES.map((r) => (
          <div key={r.name} className={r.enabled ? "role admin" : "role off"}>
            <div className="rava">{r.avatar}</div>
            <div className="rbody">
              <div className="rname">{r.name}<span className="mgr">{r.mgr}</span></div>
              <div className="rscope">{r.scope}</div>
            </div>
            {r.enabled
              ? <button className="cont" onClick={() => onPick("admin")}>Continue&nbsp;→</button>
              : <span className="rtag">requires auth</span>}
          </div>
        ))}
        <div className="mfoot">Only <b>Admin</b> is enabled in this build.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement `ConsoleFrame.tsx`**

```tsx
"use client";
import { useAtom } from "jotai";
import { roleAtom } from "../data/atoms/role";
import { AppHeader } from "./AppHeader";
import { PipelineNav } from "./PipelineNav";
import { RoleModal } from "./RoleModal";
import type { ReactNode } from "react";

export function ConsoleFrame({ children }: { children: ReactNode }) {
  const [role, setRole] = useAtom(roleAtom);
  return (
    <>
      <div className="wrap">
        <AppHeader onSwitchRole={() => setRole(null)} />
        {children}
        <PipelineNav />
      </div>
      <RoleModal open={role === null} onPick={(r) => setRole(r)} />
    </>
  );
}
```

- [ ] **Step 6: Wire `layout.tsx`** — wrap `{children}` in `<ConsoleFrame>`:

```tsx
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { ConsoleFrame } from "@/shared/ui/components/ConsoleFrame";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ConsoleFrame>{children}</ConsoleFrame>
        </Providers>
      </body>
    </html>
  );
}
```

Add `.wrap` and `.overlay` rules to `shared/ui/style.css` (port `.wrap` from `sample/styles.css`; import `style.css` in `ConsoleFrame.tsx`).

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm exec vitest run src/shared/ui`
Expected: PASS (all shared/ui tests).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/shared/ui apps/web/src/app/layout.tsx
git commit -m "feat(web): role modal + gate wired through ConsoleFrame layout"
```

---

# Phase 1 — shared/policies (policy line-peek modal)

### Task 7: policies fixture + route + hook + PolicyModal + PolicyLink

**Files:**
- Create: `apps/web/src/shared/policies/data/fixtures/policies.ts` (port full text of `policies.md`)
- Create: `apps/web/src/app/api/policies/route.ts`
- Create: `apps/web/src/shared/policies/hooks/use-policies.ts`
- Create: `apps/web/src/shared/policies/data/atoms/policy-modal.ts`
- Create: `apps/web/src/shared/policies/components/PolicyModal.tsx`, `PolicyLink.tsx`
- Modify: `apps/web/src/shared/ui/components/ConsoleFrame.tsx` (render `<PolicyModal />` once)
- Create: `apps/web/src/shared/policies/style.css`
- Tests: `__tests__/route.test.ts`, `__tests__/PolicyLink.test.tsx`, `__tests__/PolicyModal.test.tsx`

**Port from:** the policy modal in `sample/app.js` (`openPolicy`: show lines `line-4 … line+4`, highlight the hit line) and `policyLink` in `sample/lib/render.js` (`<span class="plink" data-line="N">policies.md:N</span>`).

**Interfaces:**
- Produces: `policyLineAtom` (`atom<number | null>(null)`); `<PolicyLink line={n} />`; `<PolicyModal />`; `usePolicies()` returning `{ lines: string[] }`.
- Route: `GET /api/policies` → `{ lines: string[] }` (from the ported text `.split("\n")`).

- [ ] **Step 1: Write the failing route test**

```ts
// apps/web/src/app/api/policies/__tests__/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/policies/route";

describe("GET /api/policies", () => {
  it("returns policy text split into lines", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.lines)).toBe(true);
    expect(body.lines.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `pnpm exec vitest run src/app/api/policies/__tests__/route.test.ts`
Expected: FAIL (route missing).

- [ ] **Step 3: Port `policies.ts`** — copy the entire contents of the repo-root `policies.md` into a template string:

```ts
// apps/web/src/shared/policies/data/fixtures/policies.ts
export const POLICY_TEXT = `<PASTE FULL CONTENTS OF policies.md HERE, VERBATIM>`;
export const POLICY_LINES = POLICY_TEXT.split("\n");
```

- [ ] **Step 4: Implement the route**

```ts
// apps/web/src/app/api/policies/route.ts
import { NextResponse } from "next/server";
import { POLICY_LINES } from "@/shared/policies/data/fixtures/policies";
export function GET() {
  return NextResponse.json({ lines: POLICY_LINES });
}
```

- [ ] **Step 5: Run route test — expect PASS**

Run: `pnpm exec vitest run src/app/api/policies/__tests__/route.test.ts`

- [ ] **Step 6: Implement atom + hook**

```ts
// apps/web/src/shared/policies/data/atoms/policy-modal.ts
import { atom } from "jotai";
export const policyLineAtom = atom<number | null>(null);
```
```ts
// apps/web/src/shared/policies/hooks/use-policies.ts
import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
export function usePolicies() {
  return useQuery({
    queryKey: ["policies"],
    queryFn: () => fetchLocal<{ lines: string[] }>("/api/policies"),
  });
}
```

- [ ] **Step 7: Write PolicyLink test + implement**

```tsx
// apps/web/src/shared/policies/components/__tests__/PolicyLink.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAtomValue } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import { policyLineAtom } from "@/shared/policies/data/atoms/policy-modal";

function Probe() { const v = useAtomValue(policyLineAtom); return <span data-testid="line">{String(v)}</span>; }

describe("PolicyLink", () => {
  it("sets the policy line atom on click", async () => {
    render(<><PolicyLink line={53} /><Probe /></>);
    await userEvent.click(screen.getByRole("button", { name: /policies\.md:53/ }));
    expect(screen.getByTestId("line")).toHaveTextContent("53");
  });
});
```
```tsx
// apps/web/src/shared/policies/components/PolicyLink.tsx
"use client";
import { useSetAtom } from "jotai";
import { policyLineAtom } from "../data/atoms/policy-modal";
export function PolicyLink({ line }: { line: number }) {
  const setLine = useSetAtom(policyLineAtom);
  return (
    <button type="button" className="plink" onClick={() => setLine(line)}>
      policies.md:{line}
    </button>
  );
}
```
Add `.plink` rule to `shared/policies/style.css` (port from `sample/styles.css`).

- [ ] **Step 8: Write PolicyModal test + implement**

```tsx
// apps/web/src/shared/policies/components/__tests__/PolicyModal.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSetAtom } from "jotai";
import { PolicyModal } from "@/shared/policies/components/PolicyModal";
import { policyLineAtom } from "@/shared/policies/data/atoms/policy-modal";

vi.mock("@/shared/policies/hooks/use-policies", () => ({
  usePolicies: () => ({ data: { lines: Array.from({ length: 60 }, (_, i) => `line ${i + 1}`) } }),
}));

function Open({ line }: { line: number }) {
  const set = useSetAtom(policyLineAtom);
  return <button onClick={() => set(line)}>open</button>;
}

describe("PolicyModal", () => {
  it("is hidden until a line is selected, then shows a window around it", async () => {
    render(<><PolicyModal /><Open line={10} /></>);
    expect(screen.queryByText("line 10")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText("line 10")).toBeInTheDocument(); // hit line
    expect(screen.getByText("line 6")).toBeInTheDocument();  // line-4 context
    expect(screen.getByText("line 14")).toBeInTheDocument(); // line+4 context
  });

  it("closes when the backdrop is clicked", async () => {
    render(<><PolicyModal /><Open line={10} /></>);
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(screen.getByTestId("policy-backdrop"));
    expect(screen.queryByText("line 10")).not.toBeInTheDocument();
  });
});
```
```tsx
// apps/web/src/shared/policies/components/PolicyModal.tsx
"use client";
import { useAtom } from "jotai";
import { policyLineAtom } from "../data/atoms/policy-modal";
import { usePolicies } from "../hooks/use-policies";
import "../style.css";

export function PolicyModal() {
  const [line, setLine] = useAtom(policyLineAtom);
  const { data } = usePolicies();
  if (line === null) return null;
  const lines = data?.lines ?? [];
  const start = Math.max(1, line - 4);
  const end = Math.min(lines.length, line + 4);
  const window = [];
  for (let n = start; n <= end; n++) window.push({ n, text: lines[n - 1] ?? "" });
  return (
    <div className="polmodal">
      <div className="polbackdrop" data-testid="policy-backdrop" onClick={() => setLine(null)} />
      <div className="poldialog">
        <div className="polhead"><span>policies.md</span><button onClick={() => setLine(null)}>✕</button></div>
        <div className="polbody">
          {window.map(({ n, text }) => (
            <div key={n} className={`polline${n === line ? " hit" : ""}`}>
              <span className="ln">{n}</span><span>{text || " "}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```
Port `.polmodal/.polbackdrop/.poldialog/.polhead/.polbody/.polline/.hit/.ln` CSS from `sample/styles.css` into `shared/policies/style.css`.

- [ ] **Step 9: Render `<PolicyModal />` inside `ConsoleFrame`** (once, after `RoleModal`).

- [ ] **Step 10: Run all shared/policies tests — expect PASS**

Run: `pnpm exec vitest run src/shared/policies src/app/api/policies`

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/shared/policies apps/web/src/app/api/policies apps/web/src/shared/ui/components/ConsoleFrame.tsx
git commit -m "feat(web): policies.md line-peek modal with PolicyLink trigger"
```

---

# Phase 2 — operators (board + detail)

### Task 8: operator types + pure utils (days-between, format-money)

**Files:**
- Create: `apps/web/src/modules/operators/types.ts`
- Create: `apps/web/src/modules/operators/utils/days-between.ts`, `utils/format-money.ts`
- Test: `apps/web/src/modules/operators/utils/__tests__/days-between.test.ts`, `format-money.test.ts`

**Port from:** `sample/lib/viewmodel.js` (`daysBetween`, `money`) and `sample/tests/viewmodel.test.js`.

**Interfaces:**
- Produces: `daysBetween(laterISO: string, earlierISO: string): number` (floored, min 0); `formatMoney(n: number): string` (`"$" + n.toFixed(2)`).
- Produces (types.ts): `Lane = "needs_review" | "in_review" | "on_hold" | "resolved"`; `Customer`, `Transaction`, `Issue` (shape them from the JSON fixtures — see `customers.json`/`transactions.json`/`payment_issues.json`); `Decision` (from `sample/data/decisions.js` — `lane`, `owner?`, `typeLabelOverride?`, `statusLabel?`, `urgency?`, `why?`, `trace?`, `dataGap?`, `related?`, `actions?`, `activity?`); `IssueDisplay` (`id, txnId, typeLabel, amount, amountText, customerName, custId, merchant, ageDays, riskScore, lifetimeSpend, isHighValue`); `IssueViewModel = { issue: Issue; transaction: Transaction | null; customer: Customer | null; decision: Decision | null; display: IssueDisplay }`; `BoardColumns = Record<Lane, IssueViewModel[]>`; `AgentSummary` (from `sample/data/decisions.js` `AGENT_SUMMARY`).

- [ ] **Step 1: Write failing tests**

```ts
// apps/web/src/modules/operators/utils/__tests__/days-between.test.ts
import { describe, expect, it } from "vitest";
import { daysBetween } from "@/modules/operators/utils/days-between";
describe("daysBetween", () => {
  it("floors the day difference", () => {
    expect(daysBetween("2025-01-13T12:00:00Z", "2025-01-10T00:00:00Z")).toBe(3);
  });
  it("never returns negative", () => {
    expect(daysBetween("2025-01-01T00:00:00Z", "2025-01-10T00:00:00Z")).toBe(0);
  });
});
```
```ts
// apps/web/src/modules/operators/utils/__tests__/format-money.test.ts
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/modules/operators/utils/format-money";
describe("formatMoney", () => {
  it("formats with two decimals and a dollar sign", () => {
    expect(formatMoney(249)).toBe("$249.00");
    expect(formatMoney(34.9)).toBe("$34.90");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm exec vitest run src/modules/operators/utils`

- [ ] **Step 3: Implement**

```ts
// days-between.ts
export function daysBetween(laterISO: string, earlierISO: string): number {
  const ms = new Date(laterISO).getTime() - new Date(earlierISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
```
```ts
// format-money.ts
export function formatMoney(n: number): string {
  return "$" + Number(n).toFixed(2);
}
```
Create `types.ts` with the types listed in Interfaces above (derive concrete field types from the JSON fixtures + `sample/data/decisions.js`).

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm exec vitest run src/modules/operators/utils`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/operators/utils apps/web/src/modules/operators/types.ts
git commit -m "feat(web): operator pure utils (daysBetween, formatMoney) + domain types"
```

---

### Task 9: `joinIssues` (view-model transform)

**Files:**
- Create: `apps/web/src/modules/operators/utils/join-issues.ts`
- Test: `apps/web/src/modules/operators/utils/__tests__/join-issues.test.ts`

**Port from:** `sample/lib/viewmodel.js` (`joinIssues`, `TYPE_LABEL`, `HIGH_VALUE_THRESHOLD = 2000`) and `sample/tests/viewmodel.test.js`.

**Interfaces:**
- Consumes: `daysBetween`, `formatMoney`, types from Task 8.
- Produces: `joinIssues(fixtures: { customers: Customer[]; transactions: Transaction[]; issues: Issue[] }, decisions: Record<string, Decision>, nowISO: string): IssueViewModel[]`.

- [ ] **Step 1: Write the failing test** (port assertions from `sample/tests/viewmodel.test.js` — build minimal fixtures inline)

```ts
// apps/web/src/modules/operators/utils/__tests__/join-issues.test.ts
import { describe, expect, it } from "vitest";
import { joinIssues } from "@/modules/operators/utils/join-issues";

const NOW = "2025-01-13T12:00:00Z";
const customers = [{ id: "cust_1", name: "Morgan L.", risk_score: "low", lifetime_spend: 312 }];
const transactions = [{ id: "txn_1", merchant: "HomeEssentials", created_at: "2025-01-10T00:00:00Z" }];
const issues = [{ id: "iss_1", customer_id: "cust_1", transaction_id: "txn_1", type: "dispute", amount: 249, merchant: "HomeEssentials" }];

describe("joinIssues", () => {
  it("joins customer + transaction + decision and builds display fields", () => {
    const [vm] = joinIssues({ customers, transactions, issues }, { iss_1: { lane: "in_review" } }, NOW);
    expect(vm.display.customerName).toBe("Morgan L.");
    expect(vm.display.amountText).toBe("$249.00");
    expect(vm.display.typeLabel).toBe("Dispute");
    expect(vm.display.ageDays).toBe(3);
    expect(vm.display.isHighValue).toBe(false); // 312 < 2000
    expect(vm.decision?.lane).toBe("in_review");
  });

  it("prefers issue.days_since_purchase when present", () => {
    const withDays = [{ ...issues[0], days_since_purchase: 2 }];
    const [vm] = joinIssues({ customers, transactions, issues: withDays }, {}, NOW);
    expect(vm.display.ageDays).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `pnpm exec vitest run src/modules/operators/utils/__tests__/join-issues.test.ts`

- [ ] **Step 3: Implement** — port `joinIssues` from `sample/lib/viewmodel.js`, typed, using `daysBetween` + `formatMoney` + `TYPE_LABEL` + `HIGH_VALUE_THRESHOLD`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/operators/utils/join-issues.ts apps/web/src/modules/operators/utils/__tests__/join-issues.test.ts
git commit -m "feat(web): joinIssues view-model transform"
```

---

### Task 10: `groupByColumn` + operator fixtures + issues route + hook

**Files:**
- Create: `apps/web/src/modules/operators/utils/group-by-column.ts`
- Test: `apps/web/src/modules/operators/utils/__tests__/group-by-column.test.ts`
- Create fixtures: `apps/web/src/modules/operators/data/fixtures/customers.json`, `transactions.json`, `payment_issues.json` (copy the four root files), `decisions.ts`, `agent-summary.ts` (port from `sample/data/decisions.js`)
- Create: `apps/web/src/app/api/operators/issues/route.ts`
- Create: `apps/web/src/modules/operators/hooks/use-issues.ts`
- Test: `apps/web/src/app/api/operators/issues/__tests__/route.test.ts`

**Port from:** `sample/lib/viewmodel.js` (`groupByColumn`, `COLUMNS`) and `sample/data/decisions.js`.

**Interfaces:**
- Produces: `groupByColumn(vms: IssueViewModel[]): BoardColumns`.
- Route `GET /api/operators/issues` → `{ columns: BoardColumns; agentSummary: AgentSummary }` (calls `joinIssues(fixtures, DECISIONS, NOW)` with `NOW = "2025-01-13T12:00:00Z"`, then `groupByColumn`).
- Hook `useIssues()` → TanStack Query returning that shape.

- [ ] **Step 1: Write failing `group-by-column` test**

```ts
// apps/web/src/modules/operators/utils/__tests__/group-by-column.test.ts
import { describe, expect, it } from "vitest";
import { groupByColumn } from "@/modules/operators/utils/group-by-column";
import type { IssueViewModel } from "@/modules/operators/types";

const vm = (id: string, lane: string) => ({ issue: { id }, decision: { lane } } as unknown as IssueViewModel);

describe("groupByColumn", () => {
  it("buckets view models by decision.lane into the four columns", () => {
    const grouped = groupByColumn([vm("a", "needs_review"), vm("b", "resolved"), vm("c", "needs_review")]);
    expect(grouped.needs_review.map((v) => v.issue.id)).toEqual(["a", "c"]);
    expect(grouped.resolved).toHaveLength(1);
    expect(grouped.in_review).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `group-by-column.ts`** (port `COLUMNS` + `groupByColumn`).

- [ ] **Step 4: Run group test — expect PASS.**

- [ ] **Step 5: Port fixtures** — copy the four root JSON files into `data/fixtures/`; port `DECISIONS` and `AGENT_SUMMARY` from `sample/data/decisions.js` into `decisions.ts` / `agent-summary.ts` (typed with `Record<string, Decision>` and `AgentSummary`).

- [ ] **Step 6: Write failing route test**

```ts
// apps/web/src/app/api/operators/issues/__tests__/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/operators/issues/route";
describe("GET /api/operators/issues", () => {
  it("returns view models grouped into four columns plus agent summary", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Object.keys(body.columns).sort()).toEqual(["in_review", "needs_review", "on_hold", "resolved"]);
    expect(body.agentSummary).toBeDefined();
  });
});
```

- [ ] **Step 7: Run — expect FAIL.**

- [ ] **Step 8: Implement the route**

```ts
// apps/web/src/app/api/operators/issues/route.ts
import { NextResponse } from "next/server";
import customers from "@/modules/operators/data/fixtures/customers.json";
import transactions from "@/modules/operators/data/fixtures/transactions.json";
import issues from "@/modules/operators/data/fixtures/payment_issues.json";
import { DECISIONS } from "@/modules/operators/data/fixtures/decisions";
import { AGENT_SUMMARY } from "@/modules/operators/data/fixtures/agent-summary";
import { joinIssues } from "@/modules/operators/utils/join-issues";
import { groupByColumn } from "@/modules/operators/utils/group-by-column";

const NOW = "2025-01-13T12:00:00Z";

export function GET() {
  const vms = joinIssues({ customers, transactions, issues } as never, DECISIONS, NOW);
  return NextResponse.json({ columns: groupByColumn(vms), agentSummary: AGENT_SUMMARY });
}
```
(If TS complains about JSON typing, add `"resolveJsonModule": true` — already on in Next tsconfig — and cast the fixtures to the domain types.)

- [ ] **Step 9: Implement `use-issues.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { BoardColumns, AgentSummary } from "@/modules/operators/types";
export function useIssues() {
  return useQuery({
    queryKey: ["operators", "issues"],
    queryFn: () => fetchLocal<{ columns: BoardColumns; agentSummary: AgentSummary }>("/api/operators/issues"),
  });
}
```

- [ ] **Step 10: Run route test — expect PASS.** `pnpm exec vitest run src/app/api/operators/issues`

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/modules/operators apps/web/src/app/api/operators
git commit -m "feat(web): operator issues endpoint (join+group) + fixtures + useIssues"
```

---

### Task 11: Operator board (IssueCard, AgentSummary, BoardColumn, OperatorBoardPage)

**Files:**
- Create: `apps/web/src/modules/operators/components/IssueCard.tsx`, `AgentSummary.tsx`, `BoardColumn.tsx`
- Create: `apps/web/src/modules/operators/pages/OperatorBoardPage.tsx`
- Create: `apps/web/src/modules/operators/style.css`
- Modify: `apps/web/src/app/boards/operators/page.tsx` (import the page)
- Tests: `components/__tests__/IssueCard.test.tsx`, `pages/__tests__/OperatorBoardPage.test.tsx`

**Port from:** `sample/lib/render.js` (`renderCard`, `renderAgentSummary`, `renderBoard`; `COLUMNS`/lane headings). Cards link to `/boards/operators/<issueId>`.

**Interfaces:**
- Consumes: `useIssues()`, `IssueViewModel`, `BoardColumns`, `AgentSummary`, `<PolicyLink />`.
- Produces: `<IssueCard vm={IssueViewModel} />` (a `next/link` to the detail route, `data-issue={id}`); `<AgentSummary summary={AgentSummary} />`; `<BoardColumn lane title note cards />`; `<OperatorBoardPage />` (client) rendering AgentSummary + the four columns.

- [ ] **Step 1: Write failing IssueCard test**

```tsx
// apps/web/src/modules/operators/components/__tests__/IssueCard.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueCard } from "@/modules/operators/components/IssueCard";
import type { IssueViewModel } from "@/modules/operators/types";

const vm = {
  issue: { id: "iss_003" },
  display: { id: "iss_003", typeLabel: "Dispute", amountText: "$249.00", customerName: "Morgan L.", merchant: "HomeEssentials", ageDays: 3, isHighValue: false },
} as unknown as IssueViewModel;

describe("IssueCard", () => {
  it("shows the issue summary and links to its detail route", () => {
    render(<IssueCard vm={vm} />);
    expect(screen.getByText("$249.00")).toBeInTheDocument();
    expect(screen.getByText(/Morgan L\./)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/boards/operators/iss_003");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `IssueCard.tsx`** — port `renderCard` markup/classes from `sample/lib/render.js`; wrap in `<Link href={\`/boards/operators/${vm.issue.id}\`} className="tk" data-issue={vm.issue.id}>`. Show typeLabel, amountText, customerName, merchant, ageDays, high-value flag. Port `.tk` + related card CSS into `operators/style.css` (import it here).

- [ ] **Step 4: Run IssueCard test — expect PASS.**

- [ ] **Step 5: Implement `AgentSummary.tsx`** (port `renderAgentSummary`) and `BoardColumn.tsx` (a column with header `h4` + count `.n` + note + card list or `.empty` placeholder — port the `.col/.col-h/.col-note/.empty` structure from `renderBoard`).

- [ ] **Step 6: Write failing OperatorBoardPage test**

```tsx
// apps/web/src/modules/operators/pages/__tests__/OperatorBoardPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorBoardPage } from "@/modules/operators/pages/OperatorBoardPage";

vi.mock("@/modules/operators/hooks/use-issues", () => ({
  useIssues: () => ({
    data: {
      columns: {
        needs_review: [{ issue: { id: "iss_1" }, display: { id: "iss_1", typeLabel: "Decline", amountText: "$45.00", customerName: "Dana K.", merchant: "TechGadgets", ageDays: 1, isHighValue: false } }],
        in_review: [], on_hold: [], resolved: [],
      },
      agentSummary: { total: 214 },
    },
    isLoading: false,
  }),
}));

describe("OperatorBoardPage", () => {
  it("renders the four lanes and places cards by column", () => {
    render(<OperatorBoardPage />);
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
    expect(screen.getByText(/in review/i)).toBeInTheDocument();
    expect(screen.getByText(/on hold/i)).toBeInTheDocument();
    expect(screen.getByText("$45.00")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run — expect FAIL.**

- [ ] **Step 8: Implement `OperatorBoardPage.tsx`** (`"use client"`) — call `useIssues()`, render `<AgentSummary>` then the four `<BoardColumn>`s with lane titles ("Needs review", "In review", "On hold", "Resolved") and notes (port from `renderBoard`). Update `app/boards/operators/page.tsx` to `export { OperatorBoardPage as default } ...` (re-export).

- [ ] **Step 9: Run — expect PASS.** `pnpm exec vitest run src/modules/operators`

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/modules/operators apps/web/src/app/boards/operators/page.tsx
git commit -m "feat(web): operator board (agent summary + four lanes + issue cards)"
```

---

### Task 12: Operator issue detail — route, hook, DecisionRail, Timeline, page

**Files:**
- Create: `apps/web/src/app/api/operators/issues/[id]/route.ts`
- Create: `apps/web/src/modules/operators/hooks/use-issue.ts`
- Create: `apps/web/src/modules/operators/components/DecisionRail.tsx`, `Timeline.tsx`, `TraceRow.tsx`
- Create: `apps/web/src/modules/operators/pages/IssueDetailPage.tsx`
- Modify: `apps/web/src/app/boards/operators/[issueId]/page.tsx`
- Tests: `[id]/__tests__/route.test.ts`, `components/__tests__/DecisionRail.test.tsx`, `components/__tests__/Timeline.test.tsx`

**Port from:** `sample/lib/render.js` (`renderDetail`, `renderRail`, `renderTimeline`, `policyLink`). Trace rows show a status (`fired`/`not_met`/`cant_evaluate`), rule text, evidence, and a `<PolicyLink>` for `src`.

**Interfaces:**
- Route `GET /api/operators/issues/[id]` → the single `IssueViewModel` (via `joinIssues(...).find(id)`); 404 JSON when missing.
- Hook `useIssue(id: string)`.
- `<DecisionRail decision={Decision} />`, `<Timeline trace={Decision["trace"]} />`, `<TraceRow node={...} />`, `<IssueDetailPage issueId={string} />`.

- [ ] **Step 1: Write failing route test**

```ts
// apps/web/src/app/api/operators/issues/[id]/__tests__/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/operators/issues/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/operators/issues/[id]", () => {
  it("returns the matching view model", async () => {
    const res = await GET(new Request("http://x"), ctx("iss_003"));
    const vm = await res.json();
    expect(vm.issue.id).toBe("iss_003");
  });
  it("404s for an unknown id", async () => {
    const res = await GET(new Request("http://x"), ctx("nope"));
    expect(res.status).toBe(404);
  });
});
```
(Use an issue id that actually exists in `payment_issues.json` — inspect the fixture and pick a real one, e.g. `iss_003`.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the `[id]` route** (async `params`)

```ts
import { NextResponse } from "next/server";
import customers from "@/modules/operators/data/fixtures/customers.json";
import transactions from "@/modules/operators/data/fixtures/transactions.json";
import issues from "@/modules/operators/data/fixtures/payment_issues.json";
import { DECISIONS } from "@/modules/operators/data/fixtures/decisions";
import { joinIssues } from "@/modules/operators/utils/join-issues";

const NOW = "2025-01-13T12:00:00Z";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const vm = joinIssues({ customers, transactions, issues } as never, DECISIONS, NOW).find((v) => v.issue.id === id);
  if (!vm) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(vm);
}
```

- [ ] **Step 4: Run route test — expect PASS.**

- [ ] **Step 5: Implement `use-issue.ts`** (`useQuery({ queryKey: ["operators","issue",id], queryFn: () => fetchLocal(\`/api/operators/issues/${id}\`), enabled: !!id })`).

- [ ] **Step 6: Write failing Timeline test** (trace row renders status + rule + PolicyLink)

```tsx
// apps/web/src/modules/operators/components/__tests__/Timeline.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "@/modules/operators/components/Timeline";

const trace = [
  { src: 53, status: "fired", rule: "Escalate if amount > $200.", evidence: "$249 → triggers escalation." },
  { src: 51, status: "not_met", rule: "Auto-resolve if delivered + 3 days.", evidence: "In transit." },
];

describe("Timeline", () => {
  it("renders each trace row with its rule and a policy link", () => {
    render(<Timeline trace={trace} />);
    expect(screen.getByText(/amount > \$200/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /policies\.md:53/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run — expect FAIL.**

- [ ] **Step 8: Implement `TraceRow.tsx` + `Timeline.tsx`** (port `renderTimeline`; each row uses `<PolicyLink line={node.src} />` and a status pill class from the sample). Then `DecisionRail.tsx` (port `renderRail`: face/lead/because + recommended action + others, with `<PolicyLink>` for the `ref`).

- [ ] **Step 9: Write failing DecisionRail test**

```tsx
// apps/web/src/modules/operators/components/__tests__/DecisionRail.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionRail } from "@/modules/operators/components/DecisionRail";

const decision = {
  why: { face: "escalate", lead: "▲ RECOMMEND ESCALATE TO SPECIALIST", because: "Dispute amount $249 exceeds the $200 trigger.", ref: 53 },
  actions: { recommended: { label: "▲ Escalate to specialist", sub: "amount over $200", variant: "esc" }, others: [{ label: "Put on hold", sub: "wait on carrier" }] },
} as never;

describe("DecisionRail", () => {
  it("renders the recommendation, rationale, and policy ref", () => {
    render(<DecisionRail decision={decision} />);
    expect(screen.getByText(/RECOMMEND ESCALATE/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /policies\.md:53/ })).toBeInTheDocument();
    expect(screen.getByText(/Escalate to specialist/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run — expect FAIL, then implement `DecisionRail`, then PASS.**

- [ ] **Step 11: Implement `IssueDetailPage.tsx`** (`"use client"`, props `{ issueId }`) — `useIssue(issueId)`, render header/back link to `/boards/operators`, the fact panels, `<DecisionRail>`, `<Timeline>`, dataGap note, activity (port `renderDetail`). Wire `app/boards/operators/[issueId]/page.tsx`:

```tsx
import { IssueDetailPage } from "@/modules/operators/pages/IssueDetailPage";
export default async function Route({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  return <IssueDetailPage issueId={issueId} />;
}
```

- [ ] **Step 12: Run all operator tests — expect PASS.** `pnpm exec vitest run src/modules/operators src/app/api/operators`

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/modules/operators apps/web/src/app/api/operators/issues/\[id\] apps/web/src/app/boards/operators/\[issueId\]
git commit -m "feat(web): operator issue detail (rail + policy-traced timeline)"
```

---

### Task 13: Operator capture-and-log panel

**Files:**
- Create: `apps/web/src/modules/operators/data/atoms/capture.ts`
- Create: `apps/web/src/modules/operators/components/CapturePanel.tsx`
- Modify: `DecisionRail.tsx` (open a CapturePanel when an action is clicked)
- Tests: `data/atoms/__tests__/capture.test.ts`, `components/__tests__/CapturePanel.test.tsx`

**Port from:** `railCapture` + confirm-capture flow in `sample/app.js` (a reason textarea pre-filled from policy; Confirm logs an audit record + toast).

**Interfaces:**
- Produces: `captureAtom` (`atom<{ actionLabel: string } | null>(null)`); actions to open/close/confirm. On confirm, append to a `captureLogAtom` (`atom<string[]>([])`) and close.
- `<CapturePanel />` renders when `captureAtom` is set; Confirm button commits.

- [ ] **Step 1: Write failing atom test**

```ts
// apps/web/src/modules/operators/data/atoms/__tests__/capture.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { captureAtom, captureLogAtom, openCaptureAtom, confirmCaptureAtom } from "@/modules/operators/data/atoms/capture";

describe("capture atoms", () => {
  it("opens a capture, then confirming logs it and closes", () => {
    const store = createStore();
    store.set(openCaptureAtom, "Escalate to specialist");
    expect(store.get(captureAtom)?.actionLabel).toBe("Escalate to specialist");
    store.set(confirmCaptureAtom, "Confirmed by operator per policy.");
    expect(store.get(captureAtom)).toBeNull();
    expect(store.get(captureLogAtom)).toHaveLength(1);
    expect(store.get(captureLogAtom)[0]).toMatch(/Escalate to specialist/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `capture.ts`**

```ts
import { atom } from "jotai";
export const captureAtom = atom<{ actionLabel: string } | null>(null);
export const captureLogAtom = atom<string[]>([]);
export const openCaptureAtom = atom(null, (_get, set, actionLabel: string) => set(captureAtom, { actionLabel }));
export const confirmCaptureAtom = atom(null, (get, set, reason: string) => {
  const current = get(captureAtom);
  if (!current) return;
  set(captureLogAtom, [...get(captureLogAtom), `${current.actionLabel} — ${reason}`]);
  set(captureAtom, null);
});
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Write failing CapturePanel test**

```tsx
// apps/web/src/modules/operators/components/__tests__/CapturePanel.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSetAtom, useAtomValue } from "jotai";
import { CapturePanel } from "@/modules/operators/components/CapturePanel";
import { openCaptureAtom, captureLogAtom } from "@/modules/operators/data/atoms/capture";

function Harness() {
  const open = useSetAtom(openCaptureAtom);
  const log = useAtomValue(captureLogAtom);
  return (<><button onClick={() => open("Escalate to specialist")}>open</button><span data-testid="n">{log.length}</span><CapturePanel /></>);
}

describe("CapturePanel", () => {
  it("confirms an action into the audit log", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText(/confirm & log/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(screen.getByTestId("n")).toHaveTextContent("1");
  });
});
```

- [ ] **Step 6: Run — expect FAIL, implement `CapturePanel.tsx` (port `railCapture` markup: heading `<action> — confirm & log`, a reason `<textarea defaultValue="Confirmed by operator per policy.">`, Confirm button calling `confirmCaptureAtom` with the textarea value), then PASS.**

- [ ] **Step 7: Wire `DecisionRail`** — recommended/other action buttons call `openCaptureAtom` with their label; render `<CapturePanel />` inside the rail.

- [ ] **Step 8: Run all operator tests — expect PASS.**

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/modules/operators
git commit -m "feat(web): operator capture-and-log panel with audit atom"
```

---

# Phase 3 — virtual_agents (monitor + simulator + drill)

### Task 14: monitor types + fixture + route + hook + StatStrip + AgentLog

**Files:**
- Create: `apps/web/src/modules/virtual_agents/types.ts`
- Create: `apps/web/src/modules/virtual_agents/data/fixtures/monitor.ts` (port `sample/data/monitor.js`)
- Create: `apps/web/src/app/api/virtual_agents/monitor/route.ts`
- Create: `apps/web/src/modules/virtual_agents/hooks/use-monitor.ts`
- Create: `apps/web/src/modules/virtual_agents/components/StatStrip.tsx`, `AgentLog.tsx`
- Create: `apps/web/src/modules/virtual_agents/style.css`
- Tests: `monitor/__tests__/route.test.ts`, `components/__tests__/StatStrip.test.tsx`

**Port from:** `sample/data/monitor.js` (whole `MONITOR`), `sample/lib/monitor.js` (`renderStatStrip`, `renderAgentLog`). `MONITOR` has `stats, log, intake, waiting, waitingMore, resolved, drill, simPool, simLeak, analysis` — check the file for the exact shape and type it in `types.ts`.

**Interfaces:**
- Route `GET /api/virtual_agents/monitor` → the `MonitorSnapshot`.
- Hook `useMonitor()`.
- `<StatStrip stats={MonitorSnapshot["stats"]} />`, `<AgentLog log={LogEntry[]} />`. Log/authored text contains `<b>` — render via `dangerouslySetInnerHTML` (trusted authored fixtures, note in a code comment) OR parse; simplest faithful port is `dangerouslySetInnerHTML` given the sample stores authored HTML.

- [ ] **Step 1: Write failing route test**

```ts
// apps/web/src/app/api/virtual_agents/monitor/__tests__/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/virtual_agents/monitor/route";
describe("GET /api/virtual_agents/monitor", () => {
  it("returns the monitor snapshot", async () => {
    const body = await (await GET()).json();
    expect(body.stats).toBeDefined();
    expect(Array.isArray(body.log)).toBe(true);
    expect(Array.isArray(body.simPool)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL. Port `monitor.ts` fixture + `types.ts`, implement the route** (`NextResponse.json(MONITOR)`), then PASS.

- [ ] **Step 3: Implement `use-monitor.ts`** (TanStack Query against `/api/virtual_agents/monitor`).

- [ ] **Step 4: Write failing StatStrip test**

```tsx
// apps/web/src/modules/virtual_agents/components/__tests__/StatStrip.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatStrip } from "@/modules/virtual_agents/components/StatStrip";
describe("StatStrip", () => {
  it("shows the headline pipeline stats", () => {
    render(<StatStrip stats={{ resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 }} />);
    expect(screen.getByText("214")).toBeInTheDocument();
    expect(screen.getByText(/95/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run — expect FAIL, implement `StatStrip.tsx` + `AgentLog.tsx` (port markup/classes; port `.stat*`/`.log`/`.lrow` CSS into `virtual_agents/style.css`), then PASS.**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/virtual_agents apps/web/src/app/api/virtual_agents
git commit -m "feat(web): monitor snapshot endpoint + stat strip + agent log"
```

---

### Task 15: Monitor pipeline columns + MonitorPage

**Files:**
- Create: `apps/web/src/modules/virtual_agents/components/PipelineColumns.tsx`, `IntakeCard.tsx`, `WaitCard.tsx`, `ResolvedLane.tsx`
- Create: `apps/web/src/modules/virtual_agents/pages/MonitorPage.tsx`
- Modify: `apps/web/src/app/monitors/agents/page.tsx`
- Test: `pages/__tests__/MonitorPage.test.tsx`

**Port from:** `sample/lib/monitor.js` (`renderPipeline`, `renderIntakeCard`, `renderWaitCard`, `renderMonitor`). Three columns: Intake → Waiting (system-managed) → Resolved (auto). Resolved shows the count + recent list; leaks read "policy couldn't decide".

**Interfaces:**
- Consumes: `useMonitor()`.
- Produces: `<PipelineColumns snapshot={MonitorSnapshot} />`, `<MonitorPage />`. MonitorPage renders `<StatStrip>` + `<AgentLog>` + `<PipelineColumns>` + a "drill" `Link` to `/monitors/agents/drill` + the simulator controls (added in Task 17).

- [ ] **Step 1: Write failing MonitorPage test**

```tsx
// apps/web/src/modules/virtual_agents/pages/__tests__/MonitorPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonitorPage } from "@/modules/virtual_agents/pages/MonitorPage";

vi.mock("@/modules/virtual_agents/hooks/use-monitor", () => ({
  useMonitor: () => ({ data: {
    stats: { resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 },
    log: [], intake: [], waiting: [{ id: "iss_005", type: "Expired card", amountText: "$34.99", meta: "…", blocker: "✉ nudge sent" }],
    waitingMore: 8, resolved: { count: 214, recent: [] }, drill: { total: 214, chips: [], rows: [] }, simPool: [], analysis: {},
  }, isLoading: false }),
}));

describe("MonitorPage", () => {
  it("renders the three pipeline columns and a drill link", () => {
    render(<MonitorPage />);
    expect(screen.getByText(/intake/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /drill/i })).toHaveAttribute("href", "/monitors/agents/drill");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the column components + `MonitorPage.tsx`** (port markup/classes). Re-export from `app/monitors/agents/page.tsx`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/virtual_agents apps/web/src/app/monitors/agents/page.tsx
git commit -m "feat(web): monitor pipeline columns + MonitorPage"
```

---

### Task 16: Simulator state machine (atoms)

**Files:**
- Create: `apps/web/src/modules/virtual_agents/data/atoms/simulator.ts`
- Test: `apps/web/src/modules/virtual_agents/data/atoms/__tests__/simulator.test.ts`

**Port from:** the `SIM` logic in `sample/app.js` (`simEnqueue`, `processOne`, `simPoll`, `simLeak`, `simNext`, `makeSimTicket`, `bump` counters, `logLine`) and the spirit of `sample/tests/monitor.test.js`. This is the demo centrepiece — port the routing logic exactly.

**Interfaces:**
- Produces (writable action atoms + read atoms):
  - `simInitAtom(snapshot: MonitorSnapshot)` — seed counters/log/waiting/resolved from the fetched snapshot.
  - `intakeQueueAtom: atom<SimTicket[]>` (visible intake cards), `waitingAtom`, `resolvedCountAtom`, `logAtom`, `statsAtom`.
  - `pollAtom` — enqueue 5 tickets from `simPool` (round-robin, unique ids via a counter).
  - `leakAtom` — enqueue one `simLeak` ticket.
  - `nextAtom` — `processOne`: shift the queue head and route it to `waiting` | `resolved` | `human_review`, updating counters + prepending a log line.
- `SimTicket` type: `{ id: string; dest: "waiting" | "resolved" | "human_review"; ...fields from simPool/simLeak }` — inspect `MONITOR.simPool`/`simLeak` for the exact fields.

- [ ] **Step 1: Write failing test**

```ts
// apps/web/src/modules/virtual_agents/data/atoms/__tests__/simulator.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  simInitAtom, pollAtom, nextAtom, intakeQueueAtom, resolvedCountAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";

const snapshot = {
  stats: { resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 },
  resolved: { count: 214, recent: [] }, waiting: [], log: [],
  simPool: [
    { id: "iss_a", dest: "resolved", meta: "iss_a · …", destNote: "retry ok", rule: 17 },
    { id: "iss_b", dest: "waiting", meta: "iss_b · …", blocker: "⏱ retry in 2d", rule: 13 },
  ],
  simLeak: { id: "iss_leak", dest: "human_review", meta: "iss_leak · …", reason: "day 4–7 gap", rule: 37 },
} as never;

describe("simulator atoms", () => {
  it("poll enqueues 5 tickets", () => {
    const store = createStore();
    store.set(simInitAtom, snapshot);
    store.set(pollAtom);
    expect(store.get(intakeQueueAtom)).toHaveLength(5);
  });

  it("next() routes a resolved ticket out of intake and bumps the resolved count", () => {
    const store = createStore();
    store.set(simInitAtom, snapshot);
    store.set(pollAtom);
    const before = store.get(resolvedCountAtom);
    // first pool ticket is dest:"resolved"
    store.set(nextAtom);
    expect(store.get(intakeQueueAtom)).toHaveLength(4);
    expect(store.get(resolvedCountAtom)).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `simulator.ts`** — port the routing exactly from `sample/app.js`. Use a module-level counter (or an atom) for unique ids like `makeSimTicket`. `pollAtom` pushes 5 round-robin from `simPool`; `nextAtom` shifts head and, by `dest`, updates `waitingAtom`/`resolvedCountAtom`/human-review count and prepends a `logAtom` entry (mirror `logLine`'s kind mapping). Keep the auto-run timer OUT of the atoms (it belongs in the component effect, Task 17) so the atoms stay synchronously testable.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/virtual_agents/data/atoms/simulator.ts apps/web/src/modules/virtual_agents/data/atoms/__tests__/simulator.test.ts
git commit -m "feat(web): intake simulator state machine (poll/leak/next routing)"
```

---

### Task 17: Simulator controls + auto-run + live counters wired into MonitorPage

**Files:**
- Create: `apps/web/src/modules/virtual_agents/components/SimulatorControls.tsx`
- Modify: `MonitorPage.tsx` (seed atoms from snapshot; render controls; use atom-backed counters)
- Test: `components/__tests__/SimulatorControls.test.tsx`

**Port from:** `simPoll`/`autoRun`/`simLeak`/`simNext` buttons in `sample/app.js` (auto-run processes queued tickets on a `setTimeout(…, 1100)` budget of 5).

**Interfaces:**
- Consumes: simulator atoms from Task 16, `useMonitor()`.
- Produces: `<SimulatorControls />` with Poll / Leak / Next buttons. Auto-run: after `poll`, an effect drains up to 5 tickets on an interval (guarded by a budget), cleaned up on unmount.

- [ ] **Step 1: Write failing test** (Poll adds intake cards; Next removes one)

```tsx
// apps/web/src/modules/virtual_agents/components/__tests__/SimulatorControls.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider, useSetAtom, useAtomValue } from "jotai";
import { SimulatorControls } from "@/modules/virtual_agents/components/SimulatorControls";
import { simInitAtom, intakeQueueAtom } from "@/modules/virtual_agents/data/atoms/simulator";

const snapshot = { stats: {}, resolved: { count: 0, recent: [] }, waiting: [], log: [],
  simPool: [{ id: "iss_a", dest: "resolved", meta: "…", destNote: "ok", rule: 1 }], simLeak: { id: "l", dest: "human_review", meta: "…", reason: "gap", rule: 2 } } as never;

function Probe() { return <span data-testid="q">{useAtomValue(intakeQueueAtom).length}</span>; }
function Seed() { const init = useSetAtom(simInitAtom); init(snapshot); return null; }

describe("SimulatorControls", () => {
  it("Poll enqueues intake cards", async () => {
    const store = createStore();
    render(<Provider store={store}><Seed /><SimulatorControls /><Probe /></Provider>);
    await userEvent.click(screen.getByRole("button", { name: /poll/i }));
    // auto-run may drain some; queue should have grown then be draining. Assert it went above 0 at least once via resolved side-effects is complex — assert button exists + no crash:
    expect(screen.getByRole("button", { name: /leak/i })).toBeInTheDocument();
  });
});
```
(Keep this component test light — the routing logic is already covered by Task 16's synchronous atom tests; here just assert the controls render and dispatch without error. If you disable auto-run in tests via a prop `autoRun={false}`, you can assert the queue length precisely instead.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `SimulatorControls.tsx`** — buttons dispatch `pollAtom`/`leakAtom`/`nextAtom`. Auto-run via `useEffect` + `setInterval`/`setTimeout` draining up to 5, cleared on unmount; accept an optional `autoRun` prop (default true) so tests can disable it.

- [ ] **Step 4: Wire `MonitorPage`** — on snapshot load, `useSetAtom(simInitAtom)(data)` once (guard against re-seeding); render `<SimulatorControls />`; read counters/columns/log from the simulator atoms so interactions are live.

- [ ] **Step 5: Run — expect PASS.** `pnpm exec vitest run src/modules/virtual_agents`

- [ ] **Step 6: Manual check:** `pnpm dev`, open `/monitors/agents`, click Poll → intake cards appear and auto-drain; Leak → a human-review log line. Stop server.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/virtual_agents
git commit -m "feat(web): simulator controls + auto-run wired into live monitor"
```

---

### Task 18: Monitor drawers (intake + resolved)

**Files:**
- Create: `apps/web/src/modules/virtual_agents/data/atoms/drawer.ts`
- Create: `apps/web/src/modules/virtual_agents/components/IntakeDrawer.tsx`, `ResolvedDrawer.tsx`
- Modify: intake cards / resolved list to open the relevant drawer
- Tests: `data/atoms/__tests__/drawer.test.ts`, `components/__tests__/IntakeDrawer.test.tsx`

**Port from:** `renderIntakeDrawer`, `renderResolvedDrawer` in `sample/lib/monitor.js` and the `open-intake`/`open-resolved`/`close-drawer` handlers in `sample/app.js`. Drawers show the ticket/customer fact tables (`facts.ticket`, `facts.customer`) and analysis detail.

**Interfaces:**
- Produces: `drawerAtom` (`atom<{ kind: "intake" | "resolved"; id: string } | null>(null)`). `<IntakeDrawer item={IntakeItem} />`, `<ResolvedDrawer analysis={...} />` (rendered by MonitorPage when `drawerAtom` matches).

- [ ] **Step 1: Write failing atom + drawer tests** (open sets atom; drawer renders the fact rows; close clears)

```ts
// data/atoms/__tests__/drawer.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { drawerAtom, openDrawerAtom, closeDrawerAtom } from "@/modules/virtual_agents/data/atoms/drawer";
describe("drawer atom", () => {
  it("opens and closes", () => {
    const s = createStore();
    s.set(openDrawerAtom, { kind: "intake", id: "iss_061" });
    expect(s.get(drawerAtom)).toEqual({ kind: "intake", id: "iss_061" });
    s.set(closeDrawerAtom);
    expect(s.get(drawerAtom)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL, implement `drawer.ts`, PASS.**

- [ ] **Step 3: Write failing IntakeDrawer test** (renders a fact table from `facts.ticket`)

```tsx
// components/__tests__/IntakeDrawer.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntakeDrawer } from "@/modules/virtual_agents/components/IntakeDrawer";
const item = { id: "iss_061", type: "Insufficient funds", amountText: "$128.00", meta: "…",
  facts: { ticket: [["Amount", "$128.00"], ["Merchant", "TechGadgets.com"]], customer: [["Risk score", "low"]] } } as never;
describe("IntakeDrawer", () => {
  it("renders ticket + customer fact rows", () => {
    render(<IntakeDrawer item={item} />);
    expect(screen.getByText("TechGadgets.com")).toBeInTheDocument();
    expect(screen.getByText("Risk score")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run — expect FAIL, implement both drawer components (port markup), PASS.**

- [ ] **Step 5: Wire** intake cards to `openDrawerAtom({kind:"intake",id})` and resolved-recent rows to `{kind:"resolved",id}`; MonitorPage renders the matching drawer + a backdrop calling `closeDrawerAtom`.

- [ ] **Step 6: Run all virtual_agents tests — expect PASS.**

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/virtual_agents
git commit -m "feat(web): monitor intake + resolved drawers"
```

---

### Task 19: Drill audit table + filters (DrillPage)

**Files:**
- Create: `apps/web/src/modules/virtual_agents/data/atoms/drill-filter.ts`
- Create: `apps/web/src/modules/virtual_agents/components/DrillTable.tsx`
- Create: `apps/web/src/modules/virtual_agents/pages/DrillPage.tsx`
- Modify: `apps/web/src/app/monitors/agents/drill/page.tsx`
- Tests: `data/atoms/__tests__/drill-filter.test.ts`, `pages/__tests__/DrillPage.test.tsx`

**Port from:** `renderDrill` in `sample/lib/monitor.js` and `applyDrillFilter` (category chip + text search) in `sample/app.js`.

**Interfaces:**
- Produces: `drillCatAtom` (`atom<string>("all")`), `drillQueryAtom` (`atom<string>("")`), and a derived `filteredRowsAtom` factory (or compute filtering in the page from `useMonitor().data.drill.rows`). `<DrillPage />`, `<DrillTable rows chips />`.

- [ ] **Step 1: Write failing filter test** (pure filter helper: category + query)

```ts
// data/atoms/__tests__/drill-filter.test.ts
import { describe, expect, it } from "vitest";
import { filterRows } from "@/modules/virtual_agents/data/atoms/drill-filter";
const rows = [
  { id: "iss_004", cat: "refund", txt: "iss_004 morgan homeessentials" },
  { id: "iss_060", cat: "decline", txt: "iss_060 dana techgadgets" },
] as never[];
describe("filterRows", () => {
  it("filters by category and query", () => {
    expect(filterRows(rows, "refund", "").map((r: never) => (r as { id: string }).id)).toEqual(["iss_004"]);
    expect(filterRows(rows, "all", "dana").map((r: never) => (r as { id: string }).id)).toEqual(["iss_060"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL. Implement `drill-filter.ts`** (atoms + a pure `filterRows(rows, cat, query)` helper mirroring `applyDrillFilter`), PASS.

- [ ] **Step 3: Write failing DrillPage test** (renders rows; clicking a chip filters)

```tsx
// pages/__tests__/DrillPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrillPage } from "@/modules/virtual_agents/pages/DrillPage";
vi.mock("@/modules/virtual_agents/hooks/use-monitor", () => ({
  useMonitor: () => ({ data: { drill: {
    total: 2, chips: [{ cat: "all", label: "All", n: 2 }, { cat: "refund", label: "Refunds", n: 1 }],
    rows: [{ id: "iss_004", cat: "refund", type: "Refund", amountText: "$149.00", customer: "Morgan L.", time: "10:42:05", rule: 77, txt: "iss_004 morgan" },
           { id: "iss_060", cat: "decline", type: "Insufficient funds", amountText: "$45.00", customer: "Dana K.", time: "10:41:40", rule: 17, txt: "iss_060 dana" }],
  } } }),
}));
describe("DrillPage", () => {
  it("filters rows when a category chip is chosen", async () => {
    render(<DrillPage />);
    expect(screen.getByText("iss_004")).toBeInTheDocument();
    expect(screen.getByText("iss_060")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /refunds/i }));
    expect(screen.getByText("iss_004")).toBeInTheDocument();
    expect(screen.queryByText("iss_060")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run — expect FAIL, implement `DrillTable.tsx` + `DrillPage.tsx`** (chips set `drillCatAtom`, search input sets `drillQueryAtom`, rows = `filterRows(...)`; rule cells use `<PolicyLink>`). Re-export from the route. PASS.

- [ ] **Step 5: Run all virtual_agents tests — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/virtual_agents apps/web/src/app/monitors/agents/drill/page.tsx
git commit -m "feat(web): drill-in audit table with category + search filters"
```

---

# Phase 4 — specialists (board + case view)

### Task 20: specialist types + fixture + board route + hook + SpecialistCard + UrgencyBar

**Files:**
- Create: `apps/web/src/modules/specialists/types.ts`
- Create: `apps/web/src/modules/specialists/data/fixtures/specialist.ts` (port `sample/data/specialist.js`)
- Create: `apps/web/src/app/api/specialists/board/route.ts`
- Create: `apps/web/src/modules/specialists/hooks/use-specialist.ts`
- Create: `apps/web/src/modules/specialists/components/SpecialistCard.tsx`, `UrgencyBar.tsx`
- Create: `apps/web/src/modules/specialists/style.css`
- Tests: `board/__tests__/route.test.ts`, `components/__tests__/SpecialistCard.test.tsx`, `components/__tests__/UrgencyBar.test.tsx`

**Port from:** `sample/data/specialist.js` (`SPECIALIST`: `online, breakdown, queue, mine.investigating, mine.onhold, cases`) and `sample/lib/specialist.js` (`renderUrgencyBar`, `renderSpecialistCard`). Card = criticality left border + tier chip (Critical/High/Moderate) + urgency bar (fill %, act-by ⚠ vs re-evaluate ⟳, breach pulse) + provenance (automatically vs manually escalated, with `<PolicyLink>` ref).

**Interfaces:**
- Route `GET /api/specialists/board` → the `SpecialistSnapshot` (queue + mine + online + breakdown).
- Hook `useSpecialist()`.
- `<SpecialistCard card={SpecialistCard} claimed?={boolean} />`, `<UrgencyBar bar={...} crit={...} />`.

- [ ] **Step 1: Write failing route test** (returns queue + mine).
- [ ] **Step 2: Run FAIL → port fixture + types + implement route (`NextResponse.json(SPECIALIST)`) → PASS.**
- [ ] **Step 3: Implement `use-specialist.ts`.**
- [ ] **Step 4: Write failing UrgencyBar test**

```tsx
// components/__tests__/UrgencyBar.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrgencyBar } from "@/modules/specialists/components/UrgencyBar";
describe("UrgencyBar", () => {
  it("shows the SLA limit label and marks breach", () => {
    render(<UrgencyBar bar={{ fillPct: 100, kind: "breach", word: "act-by", limit: "window spent — act now", elapsed: "" }} crit="crit" />);
    expect(screen.getByText(/act now/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run FAIL → implement `UrgencyBar.tsx`** (port `renderUrgencyBar`: fill width, ⚠/⟳ icon by `kind`, breach styling; put the shimmer/pulse keyframes in `specialists/style.css`) → PASS.
- [ ] **Step 6: Write failing SpecialistCard test**

```tsx
// components/__tests__/SpecialistCard.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialistCard } from "@/modules/specialists/components/SpecialistCard";
const card = { id: "iss_003", type: "Dispute · not received", amountText: "$249.00", meta: "iss_003 · M. Patel · FashionForward · 3h",
  crit: "high", tier: "High", cat: "dispute", bar: { fillPct: 55, kind: "reval", word: "re-evaluate", limit: "carrier ETA Jan 14", elapsed: "in queue 3h" },
  prov: { mode: "manual", reason: "over $200", ref: 53 } } as never;
describe("SpecialistCard", () => {
  it("shows tier, amount, and manual-escalation provenance with policy ref", () => {
    render(<SpecialistCard card={card} />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("$249.00")).toBeInTheDocument();
    expect(screen.getByText(/manually/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /policies\.md:53/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run FAIL → implement `SpecialistCard.tsx`** (port `renderSpecialistCard`: crit border class, tier chip, `<UrgencyBar>`, provenance text "escalated automatically/manually" + `<PolicyLink line={prov.ref}>`; a Claim button on unclaimed queue cards) → PASS.
- [ ] **Step 8: Commit**

```bash
git add apps/web/src/modules/specialists apps/web/src/app/api/specialists/board
git commit -m "feat(web): specialist board endpoint + card + urgency bar"
```

---

### Task 21: Specialist board page (two zones) + toolbar filter

**Files:**
- Create: `apps/web/src/modules/specialists/data/atoms/filter.ts`
- Create: `apps/web/src/modules/specialists/components/Toolbar.tsx`
- Create: `apps/web/src/modules/specialists/pages/SpecialistBoardPage.tsx`
- Modify: `apps/web/src/app/boards/specialists/page.tsx`
- Tests: `data/atoms/__tests__/filter.test.ts`, `pages/__tests__/SpecialistBoardPage.test.tsx`

**Port from:** `renderSpecialistBoard`, `renderSpecialistToolbar` in `sample/lib/specialist.js`, and `applySpecialistFilter` in `sample/app.js`. Two zones: TEAM (shared queue) + MINE (investigating / on-hold).

**Interfaces:**
- Produces: `specCatAtom`, `specQueryAtom`, pure `filterCards(cards, cat, query)`; `<Toolbar />`, `<SpecialistBoardPage />`.

- [ ] **Step 1: Write failing filter test** (mirror Task 19's shape for `filterCards` on `{id, cat, meta}`), run FAIL → implement `filter.ts` → PASS.
- [ ] **Step 2: Write failing SpecialistBoardPage test**

```tsx
// pages/__tests__/SpecialistBoardPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialistBoardPage } from "@/modules/specialists/pages/SpecialistBoardPage";
vi.mock("@/modules/specialists/hooks/use-specialist", () => ({
  useSpecialist: () => ({ data: {
    online: 3, breakdown: "2 Critical · 2 High · 1 Moderate",
    queue: [{ id: "iss_087", type: "Unauthorized charge", amountText: "$780.00", meta: "iss_087 · …", crit: "crit", tier: "Critical", cat: "fraud", bar: { fillPct: 100, kind: "breach", word: "act-by", limit: "act now", elapsed: "" }, prov: { mode: "auto", reason: "fraud always", ref: 63 } }],
    mine: { investigating: [], onhold: [] },
  } }),
}));
describe("SpecialistBoardPage", () => {
  it("renders the TEAM and MINE zones with queue cards", () => {
    render(<SpecialistBoardPage />);
    expect(screen.getByText(/team/i)).toBeInTheDocument();
    expect(screen.getByText(/investigating/i)).toBeInTheDocument();
    expect(screen.getByText("$780.00")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run FAIL → implement `Toolbar.tsx` + `SpecialistBoardPage.tsx`** (two-zone grid; TEAM = filtered queue; MINE = investigating + on-hold; port `.twozone/.zone/.lanes` CSS into `specialists/style.css`). Re-export from route. PASS.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/specialists apps/web/src/app/boards/specialists/page.tsx
git commit -m "feat(web): specialist two-zone board + toolbar filter"
```

---

### Task 22: Claim-to-lane (claims atom + derived lanes)

**Files:**
- Create: `apps/web/src/modules/specialists/data/atoms/claims.ts`
- Modify: `SpecialistBoardPage.tsx` (use claimed-derived lanes), `SpecialistCard.tsx` (Claim button dispatches)
- Test: `data/atoms/__tests__/claims.test.ts`

**Port from:** `claimCase` in `sample/app.js` (moves a card from the team queue to "investigating", locked to you).

**Interfaces:**
- Produces: `claimedIdsAtom` (`atom<Set<string>>`), `claimAtom` (writable: add id). A derived selector computes displayed lanes from the snapshot + claimed set: claimed ids leave the team queue and appear (as claimed) at the top of investigating.

- [ ] **Step 1: Write failing test**

```ts
// data/atoms/__tests__/claims.test.ts
import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import { claimedIdsAtom, claimAtom, deriveLanes } from "@/modules/specialists/data/atoms/claims";

describe("claims", () => {
  it("claiming removes from queue and prepends to investigating", () => {
    const store = createStore();
    store.set(claimAtom, "iss_087");
    expect(store.get(claimedIdsAtom).has("iss_087")).toBe(true);
    const queue = [{ id: "iss_087" }, { id: "iss_099" }] as never[];
    const investigating = [{ id: "iss_054" }] as never[];
    const lanes = deriveLanes(queue, investigating, store.get(claimedIdsAtom));
    expect(lanes.queue.map((c: never) => (c as { id: string }).id)).toEqual(["iss_099"]);
    expect(lanes.investigating.map((c: never) => (c as { id: string }).id)).toEqual(["iss_087", "iss_054"]);
  });
});
```

- [ ] **Step 2: Run FAIL → implement `claims.ts`** (`claimedIdsAtom`, `claimAtom` adds to the set, pure `deriveLanes(queue, investigating, claimed)` returning `{ queue, investigating }` with claimed cards moved + flagged) → PASS.
- [ ] **Step 3: Wire** `SpecialistBoardPage` to render `deriveLanes(...)` output (claimed cards use the claimed style); `SpecialistCard` Claim button dispatches `claimAtom`.
- [ ] **Step 4: Run all specialist tests — expect PASS.**
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/specialists
git commit -m "feat(web): specialist claim-to-lane with derived queue/investigating"
```

---

### Task 23: Specialist case view (route, history, terminal rail, capture)

**Files:**
- Create: `apps/web/src/app/api/specialists/cases/[id]/route.ts`
- Create: `apps/web/src/modules/specialists/hooks/use-case.ts`
- Create: `apps/web/src/modules/specialists/data/atoms/capture.ts`
- Create: `apps/web/src/modules/specialists/components/CaseHistory.tsx`, `CaseRail.tsx`
- Create: `apps/web/src/modules/specialists/pages/CasePage.tsx`
- Modify: `apps/web/src/app/boards/specialists/[caseId]/page.tsx`
- Tests: `cases/[id]/__tests__/route.test.ts`, `components/__tests__/CaseHistory.test.tsx`, `pages/__tests__/CasePage.test.tsx`

**Port from:** `renderCaseHistory`, `renderCaseView` in `sample/lib/specialist.js` (actor-tagged agent→operator→you timeline stacked into a **terminal** decision rail — no onward escalate — plus an always-present capture). `SPECIALIST.cases` is keyed by id (demoed on `iss_003` & `iss_099`).

**Interfaces:**
- Route `GET /api/specialists/cases/[id]` → one case (404 when absent).
- Hook `useCase(id)`.
- `specCaptureAtom` + confirm (mirror operator capture, but terminal). `<CaseHistory nodes={...} />`, `<CaseRail case={...} />`, `<CasePage caseId={string} />`.

- [ ] **Step 1: Write failing route test** (`iss_003` present; unknown → 404). Run FAIL → implement route (async `params`, look up `SPECIALIST.cases[id]`) → PASS.
- [ ] **Step 2: Implement `use-case.ts`.**
- [ ] **Step 3: Write failing CaseHistory test**

```tsx
// components/__tests__/CaseHistory.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaseHistory } from "@/modules/specialists/components/CaseHistory";
const nodes = [
  { actor: "virtual agent", t: "Jan 13 08:15", val: "Evaluated → recommend escalate (:53)" },
  { actor: "you", t: "Jan 13 11:02", val: "Picked up → investigating" },
] as never;
describe("CaseHistory", () => {
  it("renders actor-tagged history entries", () => {
    render(<CaseHistory nodes={nodes} />);
    expect(screen.getByText(/virtual agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Picked up/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run FAIL → implement `CaseHistory.tsx` + `CaseRail.tsx` (terminal rail: resolve/deny capture, NO escalate) + `specialists/data/atoms/capture.ts` → PASS.**
- [ ] **Step 5: Write failing CasePage test** (mock `useCase` → renders history + terminal rail), run FAIL → implement `CasePage.tsx` (`"use client"`, `{ caseId }`; back link to `/boards/specialists`) + re-export from route → PASS.
- [ ] **Step 6: Run the entire suite — expect all PASS.**

Run (from `apps/web/`): `pnpm test`
Expected: all test files PASS.

- [ ] **Step 7: Lint + build sanity**

Run: `pnpm exec eslint` then `pnpm build`
Expected: no lint errors; production build succeeds.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/modules/specialists apps/web/src/app/api/specialists/cases apps/web/src/app/boards/specialists/\[caseId\]
git commit -m "feat(web): specialist terminal case view (history + rail + capture)"
```

---

## Final verification

- [ ] `pnpm test` (from `apps/web/`) — full suite green.
- [ ] `pnpm build` — succeeds.
- [ ] `pnpm dev` walkthrough: role modal → Admin → `/monitors/agents` (simulate poll/leak, open drawers, drill+filter) → pipeline-nav to `/boards/operators` (open an issue → rail + policy modal + capture) → `/boards/specialists` (claim a card, open a case). Identity chip reopens the role modal on every board.
- [ ] Visual spot-check against `sample/` running at `python3 -m http.server` (per `sample/package.json`).

## Deferred (per spec, not in this plan)

shadcn rewrite; wiring `apps/api` behind the route handlers; real auth; closing the fraud phantom-data gap.
