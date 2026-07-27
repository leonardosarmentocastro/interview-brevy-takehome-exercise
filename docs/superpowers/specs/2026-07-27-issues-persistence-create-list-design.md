# Design — `issues` persistence + create/list (first API slice)

- **Date:** 2026-07-27
- **Status:** Approved for planning
- **Area:** `apps/api`
- **Depends on:** the API `AGENTS.md` "Adding persistence" playbook (this slice
  stands that pack up for the first time)
- **Forward-compatible with:** `2026-07-27-ai-decisioning-layer-design.md` (the
  LLM harness reads whole issue rows; nothing here blocks it)

## 1. Context & goal

The backend is currently **database-free** — the API app ships the module
pattern and an opt-in persistence playbook, but no `db/client.ts`, no
`DATABASE_URL`, no Drizzle, no Postgres. This slice is the **first persistent
module**: it stands up the Drizzle/Postgres pack and delivers the two endpoints
that let an issue enter the system and be listed back.

Scope is deliberately narrow — the smallest honest vertical slice:

- `POST /issues` — submit a new payment issue (persisted).
- `GET /issues` — list issues, newest first.

**Out of scope this slice (all additive later):** status filtering on `GET`,
`GET /issues/:id`, `POST /issues/:id/review`, the status-history / decisions /
customer / transaction tables, the job queue, and the AI harness.

## 2. Decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Hybrid schema**: typed core columns + one `metadata` jsonb column | Query/join on the fields that matter; keep the varying per-type tail flexible. `metadata` (not `payload`) names the intent: type-specific attributes about the issue. |
| 2 | **One `issues` table + a `status` column** (default `pending`); **no** history/decisions/relation tables yet | "Start small — create and list." A `status` column gives later `?status=` filtering something real; history/decisions come with the queue that produces transitions. |
| 3 | **`id` = server-generated uuid PK; `external_id` = the source `iss_00x`** | Own the primary key; preserve the upstream id verbatim for tracing/idempotency. `external_id` (not `ref_id`) = "this record's id in the source system." |
| 4 | **`external_id` is `UNIQUE`; duplicate → `409 Conflict`** | Natural idempotency key: re-seeding or a retried POST won't double-insert. Cheap version of the idempotency the queue will need. |
| 5 | **Single `amount` column, normalized `amount ?? amount_due`; raw `amount_due` retained in `metadata`; `merchant` nullable** | One money column for caps/filtering (later $200 auto-execute ceiling); never lose a source fact; keep the option to redefine `amount` as a total (`amount_due × installments`) without having discarded the per-installment figure. `merchant` is absent on `missed_installment`. |
| 6 | **Validation = discriminated union on `type`, branches non-strict** | We already have the five shapes; encoding them shows domain modeling and rejects malformed issues at the edge. Non-strict branches let a *new*, not-yet-known field flow into `metadata` instead of `400`-ing — strict *required* fields per type **and** an open tail. |
| 7 | **Committed SQL migrations** (`drizzle-kit generate` → `apps/api/drizzle/*.sql`), not `drizzle-kit push` | The assignment grades "schema in the repo"; committed SQL is a versioned, reviewable, replayable artifact and the honest production pattern. |
| 8 | **One `<verb>-<noun>.api.test.ts` per resolver**, plus `schema.test.ts` + `fixtures.ts` | Mirrors the house pattern (cf. treasury-2 `expenses/__tests__`); avoids one bloated `api.test.ts`. |

## 3. Persistence pack (new infra)

Per the API `AGENTS.md` "Adding persistence" section, stand up:

- `src/db/client.ts` — `pg` pool + `drizzle(pool)`, exporting a typed `db`.
- `src/config/env.ts` — add `DATABASE_URL` to the Zod env schema.
- `drizzle.config.ts` — schema path (`src/modules/**/model.ts`), `out:
  "./drizzle"`, dialect `postgresql`, `DATABASE_URL` from env.
- `docker-compose.yml` — a local Postgres service.
- Test-DB reset hooks — `test/global-setup.ts` (migrate a clean test DB once) and
  `test/setup.ts` (truncate tables between tests), wired into `vitest.config.ts`.
- `package.json` scripts — `db:up` (compose up), `db:generate`, `db:migrate`,
  `seed`.
- Dependencies — `drizzle-orm`, `pg`; dev: `drizzle-kit`, `@types/pg`.

Migrations are generated from `model.ts` and committed under `apps/api/drizzle/`.

## 4. `issues` module (`src/modules/issues/`)

Follows the house resolver pattern exactly.

### 4.1 `model.ts` — table + enums

```
issueType   pgEnum: 'decline' | 'missed_installment' | 'dispute' | 'refund_request'
issueStatus pgEnum: 'pending' | 'processing' | 'resolved' | 'escalated'

issues:
  id           uuid   pk default gen_random_uuid()
  external_id  text   unique not null          -- source iss_00x
  type         issueType   not null
  customer_id  text   not null                 -- FK-to-be (no table yet)
  transaction_id text not null                 -- FK-to-be
  amount       numeric not null                -- normalized amount ?? amount_due
  merchant     text                            -- nullable (absent on missed_installment)
  status       issueStatus not null default 'pending'
  metadata     jsonb  not null default '{}'    -- type-specific tail + raw amount_due
  created_at   timestamptz not null            -- preserved source timestamp
  ingested_at  timestamptz not null default now()  -- our insert time
```

Source time (`created_at`) and system time (`ingested_at`) are kept distinct.
`GET /issues` orders by `ingested_at DESC`.

### 4.2 `schema.ts` — validation + normalization

- A shared `base` (`{ id, customer_id, transaction_id, created_at }`) spread into
  four per-`type` object schemas (`decline`, `missedInstallment`, `dispute`,
  `refundRequest`), combined via `z.discriminatedUnion("type", [...])`.
- Branches are **non-strict** (unknown keys are not rejected).
- A transform step produces the storage row: `amount = amount ?? amount_due`;
  known core fields → columns; **everything else** (`error_code`, `days_overdue`,
  `installment_number`, `reason`, and the raw `amount_due`) → `metadata`; incoming
  `id` → `external_id`.
- Exports `createIssueSchema` and the inferred `CreateIssueInput` /
  `NewIssueRow` types.

### 4.3 `repository.ts`

- `create(row: NewIssueRow): Promise<IssueRow>` — inserts; a Postgres
  unique-violation on `external_id` (code `23505`) is translated into
  `ConflictError`.
- `list(): Promise<IssueRow[]>` — all issues, `ingested_at DESC`.

### 4.4 `resolvers/`

- `create-issue-resolver.ts` → `createIssueResolver`: `parse` body → repository
  `create` → `201` with the created row. Zod failure → `400` (central handler);
  duplicate `external_id` → `409` via `ConflictError`.
- `list-issues-resolver.ts` → `listIssuesResolver`: repository `list` → `200`
  with the array.
- `resolvers/index.ts` barrel.

### 4.5 `routes.ts` + mount

`issuesRouter`: `POST "/"` → `createIssueResolver`, `GET "/"` →
`listIssuesResolver`. Mounted at `/issues` in `server/routes/connect.ts`.

## 5. Errors

Add `ConflictError` to `src/db/data/errors.ts`. Extend
`server/middlewares/error-handler-middleware.ts` (today: `400`/`404`/`500`) to
map `ConflictError → 409`. This is a behavior change → covered by a middleware
test in the branch it's owned (per `AGENTS.md`).

## 6. Testing (TDD, HTTP-level, one file per resolver)

`modules/issues/__tests__/`:

- `create-issue.api.test.ts` — valid body → `201` + persisted row with server
  `id` and `status: 'pending'`; duplicate `external_id` → `409`; a `decline`
  missing `error_code` (union rejects it) → `400`.
- `list-issues.api.test.ts` — seed two issues → `GET /issues` → `200`, array
  newest-first.
- `schema.test.ts` — the `iss_002` (`amount_due`) shape → `amount` normalized
  **and** raw `amount_due` preserved in `metadata`; the per-type tail lands in
  `metadata` (the "interesting edge case").
- `fixtures.ts` — shared valid bodies for the four types + invalid variants.

Middleware: extend `server/middlewares/__tests__/error-handler.test.ts` with the
`ConflictError → 409` branch (add a test-only route in `connect.ts` if needed,
per house convention).

## 7. Seeding

`apps/api/scripts/seed.ts` (or a `seed` package script) reads
`docs/initial/payment_issues.json` and inserts the five issues through the same
validation/normalization path (repository or HTTP), so the deliverable "accepts
the 5 issues" is one command. Idempotent by virtue of `external_id` uniqueness.
May land as the final task of this slice.

## 8. Data flow

```
POST /issues {source issue JSON}
  → createIssueResolver: createIssueSchema.parse  (discriminated union + normalize)
      → 400 on invalid shape
  → repository.create(row)
      → 409 on duplicate external_id
  → 201 { id, external_id, type, ..., status: 'pending', metadata, created_at, ingested_at }

GET /issues
  → listIssuesResolver → repository.list() → 200 [ ...issues ordered by ingested_at DESC ]
```

## 9. What this unblocks next (not built here)

- `GET /issues/:id` + `?status=` filtering (columns already present).
- `status_history`, `decisions`, `customers`, `transactions` tables + FKs.
- The job queue (idempotency seam already present via `external_id`).
- The AI harness (`2026-07-27-ai-decisioning-layer-design.md`), which reads whole
  issue rows and writes `Decision` objects.
