# Payment Triage Console

A decisioning layer for **policy-governed payment exceptions** in a BNPL /
payments platform (installments, merchants, disputes, subscriptions).

It sits downstream of a payments platform, takes the payment issues that
platform throws off (insufficient funds, expired cards, missed installments,
disputes, refunds), and turns a prose policy document (`policies.md`) into
consistent, auditable decisions — **executing the ones it's authorized to and
routing the rest with the reasoning already done.**

It doubles as a *policy-quality instrument*: cases that no policy clause can
resolve surface as visible blind spots instead of silently leaking.

## The product model — a three-tier pipeline

Tickets are promoted up the ladder when the tier below can't resolve them:

```
Virtual Agent (machine)  ──promote──▶  Operator (human)  ──escalate──▶  Specialist
 auto-resolve, retries,                shared backlog +                 fraud, big
 timed holds (read-only                private review lanes              disputes,
 monitor)                              (the MVP's core board)            high-value
```

Each tier has its own board/screen; a bottom navigation makes the progressive
flow explicit.

## Screens

| Route | Screen | Role |
| --- | --- | --- |
| `/` | Role selection | Pick an identity (only **admin** enabled in the MVP). |
| `/monitors/agents` | Virtual Agent monitor | Read-only live status stream of machine-handled tickets + a ticket **simulator**. |
| `/boards/operators` | Operator board | The core workspace: needs-review → in-review → on-hold → resolved lanes with policy-traced decisions. |
| `/boards/specialists` | Specialist board | Escalated, high-authority cases (fraud, big disputes). |

## Tech stack

**Monorepo:** [pnpm workspaces](https://pnpm.io) + [Turborepo](https://turbo.build)
· TypeScript throughout · Vitest for tests.

**`apps/web` (frontend):**
- [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Jotai](https://jotai.org) for client state (the ticket "state machine")
- [TanStack Query](https://tanstack.com/query) for server state
- [react-hook-form](https://react-hook-form.com) + [Zod](https://zod.dev) for forms/validation
- [lucide-react](https://lucide.dev) icons
- Vitest + Testing Library (jsdom)

**`apps/api` (backend):**
- [Express 5](https://expressjs.com) + TypeScript ([tsx](https://tsx.is) dev runtime)
- Zod validation, cors, dotenv
- Database-free base (persistence is opt-in — see `apps/api/AGENTS.md`)
- Vitest (HTTP-level tests)

## Getting started

Requirements: **Node 20+** and **pnpm 9** (`packageManager` pins `pnpm@9.12.0`).

```bash
pnpm install          # install all workspaces
pnpm dev              # run every app in dev (turbo)
```

Or run apps individually:

```bash
pnpm --filter web dev   # Next.js dev server (http://localhost:3000)
pnpm --filter api dev   # Express API (http://localhost:3333)
```

Other workspace scripts:

```bash
pnpm build            # build all apps
pnpm test             # run all test suites
pnpm lint             # lint all apps
```

> The MVP is fully interactable from the frontend alone — tickets are
> orchestrated through frontend state (Jotai). The API currently exposes only a
> `health` endpoint and is scaffolded to grow.

## Project structure

```
.
├── apps/
│   ├── web/            # Next.js frontend (DDD feature modules)
│   │   └── src/
│   │       ├── app/            # App Router pages (routes only)
│   │       ├── modules/        # feature modules: operators, specialists,
│   │       │                   #   virtual_agents (components/pages/data/hooks)
│   │       └── shared/         # policies, ui, api helpers
│   └── api/            # Express backend (module/resolver architecture)
│       └── src/modules/health/ # sample module + resolver pattern
├── docs/
│   ├── design/         # approved design docs
│   ├── plans/          # implementation plans
│   ├── superpowers/    # specs & plans (workflow)
│   └── initial/        # the original kickoff files (see docs/initial/README.md)
├── policies.md         # canonical business rules (source of truth)
├── AGENTS.md           # working agreements (TDD + feature branches)
└── pnpm-workspace.yaml / turbo.json
```

## Architectural decisions

- **Monorepo (pnpm + Turborepo).** Frontend and backend evolve together with a
  single install and shared task graph, while staying independently deployable.
- **Frontend-first MVP.** The whole triage experience — including the ticket
  lifecycle "state machine" — lives in the frontend (Jotai atoms per module).
  This let us validate the product model end-to-end before committing to
  backend infrastructure (queues, persistence, audit logging).
- **DDD feature modules on the web.** Each domain (`operators`, `specialists`,
  `virtual_agents`) is a self-contained module owning its components, pages,
  data (fixtures + atoms) and hooks. `app/` holds thin route entries only; truly
  cross-cutting concerns (policies, UI primitives, HTTP) live under `shared/`.
- **Resolver architecture on the API.** No controller→service→repository
  ceremony: a single **resolver** layer (one Express handler per operation) sits
  directly on a `repository.ts` seam. The base is database-free; persistence is
  an opt-in pack so resolvers don't change when a store is added.
  (See `apps/api/AGENTS.md`.)
- **Policy document as the source of truth.** Decisions are grounded in the
  prose `policies.md` (with a typed copy under `apps/web/src/shared/policies/`),
  and decisions carry a **trace** back to the clause that fired — making
  automated calls auditable and exposing where the policy can't decide.
- **TDD + feature branches, mandatory.** Every behavior change is a red→green→
  refactor vertical slice on a dedicated branch; tests live in `__tests__/`
  folders beside the code under test, uniform across web and API. See
  `AGENTS.md`.

## Documentation

- `docs/design/` — approved design docs per feature.
- `docs/plans/` & `docs/superpowers/` — implementation plans and specs.
- `docs/initial/` — the raw files this project started from (kickoff datasets,
  the first HTML sketch, and the brainstorming scratchpad).
- `policies.md` — the business rules the system triages against.
