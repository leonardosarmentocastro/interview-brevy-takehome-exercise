# Design — Translate `sample/` into React (three-domain web app)

- **Date:** 2026-07-26
- **Status:** Approved for planning
- **Area:** `apps/web`
- **Source of truth for the UI:** `sample/` (vanilla-JS mockup of the Payment
  Issue Console)

## 1. Context & goal

`sample/` is a working vanilla-JS mockup of the **Payment Issue Console** — a
three-layer BNPL payment-issue pipeline (virtual agent → operator → specialist).
It renders by returning HTML strings from `lib/*.js` render functions, reads
hand-authored static fixtures (`data/*.js`) plus four raw fixtures
(`customers.json`, `transactions.json`, `payment_issues.json`, `policies.md`),
and drives interactions by mutating the DOM through event delegation in
`app.js`.

**Goal:** translate `sample/` into React inside the scaffolded monorepo
(`apps/web`, Next.js App Router), organised as three DDD domain modules —
`virtual_agents`, `operators`, `specialists` — plus shared UI and policy code.
The translation is **visually exact** and **behaviourally faithful** (the live
interactions are ported, not stubbed). Work is **TDD**, one vertical slice at a
time, per the repo `AGENTS.md` files.

### Non-goals (this round)

- **No shadcn.** Plain Tailwind + ported design tokens. (Possible round-2 rewrite
  in shadcn + a refined dark theme is explicitly deferred.)
- **No real backend.** Next.js Route Handlers serve the fixtures; wiring the
  `apps/api` app is a later round.
- **No auth.** The role-selection modal is the deliberate stand-in for the
  unbuilt auth/authz layer.
- The **fraud phantom-data gap** (specialist board asks for fraud signals the
  fixtures don't contain) is surfaced honestly via clearly-staged fixtures — it
  is **not** "solved" here.

## 2. Architecture overview

```
Route Handler (server, serves fixtures)  →  TanStack Query (client read)  →  Jotai (client mutations)
```

- **Route Handlers** (`app/api/**`) import the fixtures server-side and return
  JSON. The one piece of real domain computation — the operator
  `joinIssues` / `groupByColumn` transform — runs here so the client receives
  ready-to-render view models. These handlers are the real HTTP boundary and can
  later be swapped for the `apps/api` app without touching the client.
- **TanStack Query** hooks (one per module) perform the reads.
- **Jotai** owns everything the demo mutates locally: the Query snapshot seeds
  writable atoms; interactions never hit the network. Derived atoms compute what
  is displayed.
- **App Router routes are thin** — each `page.tsx` only imports the screen
  component from its module's `pages/` folder.
- **Active view / header title / pipeline-nav highlight derive from the
  pathname** (`usePathname`), not from state.

## 3. Domain / module map

| Module | Ports from `sample/` | Screens |
|---|---|---|
| **`virtual_agents`** | `data/monitor.js`, `lib/monitor.js`, the simulator + drawers + drill logic in `app.js` | Pipeline monitor, drill-in audit table |
| **`operators`** | `data/decisions.js`, `lib/render.js`, `lib/viewmodel.js`, the raw JSON fixtures, capture panels in `app.js` | Kanban board, issue detail |
| **`specialists`** | `data/specialist.js`, `lib/specialist.js` | Two-zone board, terminal case view |
| **`shared/ui`** | `lib/shell.js`, `lib/nav.js` | Role modal, app header (ADM chip), pipeline nav (the console frame) |
| **`shared/policies`** | policy modal in `app.js`, `policyLink` (from `lib/render.js`), `policies.md` | `policies.md` line-peek modal (used by every board) |

Module folders are **plural** and `snake_case`, mirroring the API namespaces.

## 4. Folder structure

```
apps/web/src/
  app/
    layout.tsx                       # Providers + role gate + <AppHeader/> + <PolicyModal/>
    page.tsx                         # redirect → /monitors/agents
    providers.tsx                    # QueryClientProvider + Jotai Provider (extend existing)
    globals.css                      # design tokens (@theme) + reset ONLY
    monitors/agents/page.tsx         # → MonitorPage
    monitors/agents/drill/page.tsx   # → DrillPage
    boards/operators/page.tsx        # → OperatorBoardPage
    boards/operators/[issueId]/page.tsx   # → IssueDetailPage
    boards/specialists/page.tsx      # → SpecialistBoardPage
    boards/specialists/[caseId]/page.tsx  # → CasePage
    api/
      virtual_agents/monitor/route.ts        # GET → monitor snapshot
      operators/issues/route.ts              # GET → joined+grouped view models + agent summary
      operators/issues/[id]/route.ts         # GET → one issue view model
      specialists/board/route.ts             # GET → specialist board snapshot
      specialists/cases/[id]/route.ts        # GET → one specialist case
      policies/route.ts                      # GET → policies.md lines

  modules/
    virtual_agents/
      pages/          MonitorPage.tsx, DrillPage.tsx
      components/      StatStrip, AgentLog, PipelineColumns, IntakeCard, WaitCard,
                       ResolvedLane, SimulatorControls, IntakeDrawer, ResolvedDrawer,
                       DrillTable            (+ __tests__/)
      hooks/          use-monitor.ts          # TanStack Query
      data/fixtures/  monitor.ts
      data/atoms/     simulator.ts, drawer.ts, drill-filter.ts   (+ __tests__/)
      types.ts
      style.css                              # simulator/drawer chrome if needed

    operators/
      pages/          OperatorBoardPage.tsx, IssueDetailPage.tsx
      components/      IssueCard, AgentSummary, BoardColumn, DecisionRail,
                       Timeline, TraceRow, CapturePanel          (+ __tests__/)
      hooks/          use-issues.ts, use-issue.ts
      utils/          join-issues.ts, group-by-column.ts, days-between.ts,
                       format-money.ts        (+ __tests__/)      # PURE, TDD'd, used by route handler
      data/fixtures/  customers.json, transactions.json, payment_issues.json,
                       decisions.ts, agent-summary.ts
      data/atoms/     capture.ts             (+ __tests__/)
      types.ts
      style.css

    specialists/
      pages/          SpecialistBoardPage.tsx, CasePage.tsx
      components/      SpecialistCard, UrgencyBar, Toolbar, CaseHistory, CaseRail (+ __tests__/)
      hooks/          use-specialist.ts
      data/fixtures/  specialist.ts
      data/atoms/     claims.ts, filter.ts, capture.ts           (+ __tests__/)
      types.ts
      style.css                              # urgency-bar shimmer/breach keyframes, full-height scroll

  shared/
    api/request.ts                           # exists
    ui/
      components/     AppHeader, RoleModal, PipelineNav          (+ __tests__/)
      data/atoms/     role.ts
      style.css                              # role-modal / header chrome
    policies/
      components/     PolicyModal, PolicyLink                    (+ __tests__/)
      data/atoms/     policy-modal.ts
      hooks/          use-policies.ts
      style.css                              # policy-modal chrome

  lib/utils.ts                               # cn() (exists)
```

### Structural conventions (this repo)

- **`pages/`** inside a module holds the top-level screen components (plain
  React, *not* Next's legacy pages router). App Router `page.tsx` files only
  re-export/import these.
- **`data/`** inside a module encapsulates the state machine and fixtures:
  `data/atoms/` (Jotai) and `data/fixtures/`.
- **Components** are `PascalCase.tsx`, one per file; **hooks/utils** are
  `kebab-case.ts`, one primary export each; **tests** live in a `__tests__/`
  folder beside the unit under test.
- **Styling:** `globals.css` holds *only* design tokens (`@theme`) + reset.
  Any module-specific CSS (keyframes, complex selectors) lives in that module's
  `style.css` and is imported by its page/component. Everything else is Tailwind
  utilities referencing the tokens.

## 5. Routing

| URL | Screen | Module |
|---|---|---|
| `/` | redirect → `/monitors/agents` | — |
| `/monitors/agents` | MonitorPage | `virtual_agents` |
| `/monitors/agents/drill` | DrillPage | `virtual_agents` |
| `/boards/operators` | OperatorBoardPage | `operators` |
| `/boards/operators/[issueId]` | IssueDetailPage | `operators` |
| `/boards/specialists` | SpecialistBoardPage | `specialists` |
| `/boards/specialists/[caseId]` | CasePage | `specialists` |

The pipeline nav maps its three steps to `/monitors/agents`,
`/boards/operators`, `/boards/specialists`; the active step and the app-header
title are derived from `usePathname`.

## 6. Data flow detail

- **Route Handlers** import fixtures from the owning module's `data/fixtures/`
  and return JSON. `operators/issues` calls the pure `joinIssues` +
  `groupByColumn` utils (with a fixed `NOW` = `2025-01-13T12:00:00Z`, matching
  the sample) and returns `{ columns, agentSummary }`. `policies` returns the
  `policies.md` lines for the line-peek modal.
- **TanStack Query** hooks read those endpoints (`use-monitor`, `use-issues`,
  `use-issue`, `use-specialist`, `use-policies`).
- **Jotai seeding:** interactive boards initialise their writable atoms from the
  fetched snapshot (hydrate-once). All subsequent interactions mutate atoms only
  — no network.

## 7. State machine (Jotai) per module

- **`virtual_agents`**
  - `simulator.ts` — queue, auto-run budget, activity-log entries, live stat
    counters. Actions: `poll` (enqueue 5 from `simPool`), `leak`, `next` /
    `processOne` (intake → `resolved` | `waiting` | `human_review`), `autoRun`
    (budget-limited, timed). Ports `SIM`, `simPoll/simLeak/simNext`,
    `processOne`, `autoRun`, `logLine`, `bump`, `makeSimTicket`, `simEnqueue`.
  - `drawer.ts` — which intake/resolved drawer is open.
  - `drill-filter.ts` — active category chip + search query.
- **`operators`**
  - `capture.ts` — which action's capture panel is open and the logged entries.
    The board itself is read-only.
- **`specialists`**
  - `claims.ts` — claimed set; claiming moves a card from the team queue to
    "investigating" (derived atom computes the displayed lanes).
  - `filter.ts` — category chip + search.
  - `capture.ts` — terminal capture-and-log on the case view.
- **`shared/ui`** — `role.ts`: the picked role (session-only gate that dismisses
  the role modal and lands on `/monitors/agents`).
- **`shared/policies`** — `policy-modal.ts`: the clicked policy line number (or
  `null`); rendered once at the app root.

## 8. Styling

Port the palette, fonts, and spacing tokens from `sample/styles.css` into
`globals.css` as `@theme` CSS variables (dark theme, monospace accents), then
build every component with Tailwind utilities that reference those tokens. The
translation is visually exact. Component-specific CSS that is awkward as
utilities (urgency-bar shimmer + breach pulse keyframes, policy/role modal
chrome, full-height board scroll) lives in the relevant module's `style.css`.

## 9. Testing (TDD)

Red → green → refactor, one vertical slice per commit, tests in `__tests__/`
beside the unit (Vitest + Testing Library / jsdom).

- **Pure utils** — `join-issues`, `group-by-column`, `days-between`,
  `format-money`, type-label mapping. Port `sample/tests/viewmodel.test.js`.
- **Atoms / reducers** — simulator transitions (poll enqueues 5; `processOne`
  routing to resolved/waiting/human_review; auto-run budget), specialist claim
  move + derived lanes, capture logging, drill/specialist filters. Port the
  spirit of `sample/tests/monitor.test.js` and `specialist.test.js`.
- **Components** (Testing Library, user-visible behaviour) — board renders
  columns/cards; issue detail renders the decision rail + policy-traced trace;
  specialist card shows tier + urgency bar; `PolicyLink` click opens the modal;
  role modal gates entry and dismisses on pick. Re-express the substring
  assertions in `render/monitor/specialist/shell.test.js` as accessible queries.
- **Route handlers** — light shape assertions on returned JSON (optional).

If a needed test-harness piece is missing at the start of a slice, add the
minimal setup as that slice's first step (per `apps/web/AGENTS.md`).

## 10. Migration mapping (`sample/` → module)

| `sample/` unit | Destination |
|---|---|
| `lib/viewmodel.js` (`joinIssues`, `groupByColumn`, `daysBetween`, money, labels) | `operators/utils/*` (pure, TDD'd) + consumed by `api/operators/issues` |
| `lib/render.js` (`renderCard/Board/AgentSummary/Detail/Rail/Timeline`) | `operators/components/*` + `operators/pages/*` |
| `data/decisions.js`, agent summary | `operators/data/fixtures/*` |
| `customers/transactions/payment_issues.json` | `operators/data/fixtures/*.json` |
| `lib/monitor.js`, `data/monitor.js` | `virtual_agents/components/*`, `virtual_agents/pages/*`, `virtual_agents/data/fixtures/monitor.ts` |
| simulator/drawer/drill logic in `app.js` | `virtual_agents/data/atoms/*` + components |
| `lib/specialist.js`, `data/specialist.js` | `specialists/*` |
| `lib/shell.js`, `lib/nav.js` | `shared/ui/components/*` + `shared/ui/data/atoms/role.ts` |
| policy modal in `app.js`, `policyLink`, `policies.md` | `shared/policies/*` |

## 11. Deferred to a later round

- shadcn rewrite + refined dark theme.
- Wiring the `apps/api` backend behind the Route Handlers.
- Real auth/authz (role modal is today's stand-in).
- Closing the fraud phantom-data gap (surfaced, not solved).
