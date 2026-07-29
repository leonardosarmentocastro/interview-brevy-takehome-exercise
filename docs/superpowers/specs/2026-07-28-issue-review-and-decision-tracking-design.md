# Design — `POST /issues/:id/review` + decision / status-history tracking

- **Date:** 2026-07-28
- **Status:** Approved for planning
- **Area:** `apps/api` (issues module + persistence)
- **Source of truth for the lifecycle:** `policies.md`
- **Depends on:** the existing issues module (`POST /issues`, `GET /issues`,
  `GET /issues/:id`) and its Postgres/Drizzle pack.

## 1. Context & goal

This is the last endpoint of Part 1's REST surface: `POST /issues/:id/review`,
the human review decision. Alongside it we stand up the persistence the exercise
asks for in 1.2 — **tracking status history** ("when did it move
`pending → processing → resolved`?") and **recording decisions** (automated and
human).

Today the issues module stores only the current `status` on the `issues` row.
There is no history of *how* it got there and no record of *who decided what and
why*. This slice adds both, and the endpoint that lets a human write a decision.

The AI harness that will produce agent recommendations (the `Decision` output
contract in `apps/web`, per
`docs/superpowers/specs/2026-07-27-ai-decisioning-layer-design.md`) is **not**
built yet. This slice is deliberately shaped to *not* pre-commit to that layer's
schema, while leaving a clean, additive seam for it.

## 2. Scope & non-goals

**In scope:**

- `POST /issues/:id/review` — accepts a human decision, transitions the issue,
  records the decision and the status change.
- Two new tables: `issue_decisions`, `issue_status_history`.
- A new `on_hold` value on the `issue_status` enum.
- An explicit, validated transition state machine.
- A read path: `GET /issues/:id` embeds the recorded audit trail so it is
  demonstrable, not write-only.

**Out of scope (deferred to the AI cycle):**

- `recommended_action` (`auto_resolve` / `human_review` / `escalate`).
- The agent's rule/evidence **trace** and confidence.
- The agree / modify / reject comparison of a human decision against an AI
  recommendation.

These are deferred on purpose. We have not built an LLM harness/guardrails
before, and pre-committing columns to a shape we do not yet understand risks
fields we reshape later. YAGNI: build the AI-facing schema when we build the AI.
The one hedge we keep (see §3) is that the decisions table is **actor-aware**, so
the agent branch is an *additive* migration, not a reshape.

## 3. Schema changes

### 3.1 `issue_status` enum — add `on_hold`

```
issue_status: pending, processing, on_hold, escalated, resolved
```

`on_hold` is a real, policy-grounded state (a case parked pending a condition —
retry window `policies.md:13`, grace period `:34`, awaiting a new card `:24`).
This slice's human `hold` verb is its first writer; the queue/AI layer will be a
second writer later (`processing → on_hold` automatically).

### 3.2 `issue_decisions`

Append-only record of a decision taken on an issue.

```
issue_decisions
  id            uuid pk default random
  issue_id      uuid  not null  -> issues.id
  actor         enum('human','agent')  not null   -- only 'human' written this slice
  decision      text  not null                     -- 'resolve' | 'escalate' | 'hold'
  justification text  not null
  decided_by    text  not null                     -- reviewer identifier
  at            timestamptz not null default now
```

**Actor-aware from day one.** The `agent` branch is not populated in this slice.
When the AI harness lands, its fields (`recommended_action`, `rule`, `evidence`,
`confidence`, …) are added as *nullable* columns — an additive migration that
does not touch the human branch.

### 3.3 `issue_status_history`

Append-only log of every status transition.

```
issue_status_history
  id           uuid pk default random
  issue_id     uuid  not null  -> issues.id
  from_status  issue_status  null        -- null = intake (birth of the issue)
  to_status    issue_status  not null
  actor        text          not null    -- 'system' (intake) | 'human'
  decision_id  uuid          null -> issue_decisions.id  -- the decision that caused it
  at           timestamptz   not null default now
```

`decision_id` links a transition to the decision that caused it (null for the
intake row and any future purely-system transitions). This gives a clean join
for the audit trail.

### 3.4 The timeline is a projection, not a stored artifact

We do **not** persist a presentational timeline (the web's `activity[]` shape).
The source-of-truth *facts* live in the two typed tables; a single chronological
stream is derived on read by merging them, e.g.:

```sql
select 'status'   as kind, at, from_status::text as a, to_status::text as b, actor, null as note
  from issue_status_history where issue_id = $1
union all
select 'decision' as kind, at, null, decision, actor, justification
  from issue_decisions      where issue_id = $1
order by at asc;
```

A single issue's history is tiny, so the union/merge is cheap, and the timeline
can never drift from the facts.

### 3.5 Intake history row

`POST /issues` gains one extra write: an intake `issue_status_history` row
(`from_status = null`, `to_status = 'pending'`, `actor = 'system'`) so status
history is complete from birth. This is a small addition to the existing create
resolver/repository, done in the same insert transaction as the issue row.

## 4. State machine

`policies.md` speaks in three dispositions — *auto-resolve* (`:17,26,38,57,80`),
*human review* (`:3,17`), *escalate* (`:16,25,37,52,64`) — plus **waiting**
states (`:13-14`, `:24-25`, `:34-35`). The grounded lifecycle:

```
                 (queue/agent picks up)
   pending ─────────────────────────────▶ processing
   [once]                                    │  │  │
                            (policy: wait)   │  │  │  (agent auto-resolve)
                    on_hold ◀────────────────┘  │  └──────────────▶ resolved
                      │                          │                     ▲ [terminal]
      (retry/customer)│         (agent escalate) │                     │
                      └──────────────▶ escalated ◀─────────────────────┤
                                          │  (human/specialist decides)│
                                          └────────────────────────────┘
```

Two invariants: **`pending` is entered exactly once (at intake) and never
returned to**; **`resolved` is the only terminal state.**

### 4.1 Human review transition map

The review endpoint owns only the human-driven subset — three verbs, validated
against an explicit map:

| decision | target status | legal from |
|---|---|---|
| `resolve`  | `resolved`  | `processing`, `on_hold`, `escalated` |
| `escalate` | `escalated` | `processing`, `on_hold` |
| `hold`     | `on_hold`   | `processing`, `escalated` |

- `pending` is **never** reviewable — a human review requires a first agent
  verdict, so acting on intake would short-circuit the pipeline's automation.
- `resolved` is terminal.
- Any transition not in the table → **409** (e.g. review a `resolved` issue;
  `escalate` an already-`escalated` one; `hold` an already-`on_hold` one).

This lives in a pure function `nextStatusFor(current, decision)` that returns the
target status or signals an illegal transition — unit-tested over the full
matrix, independent of HTTP and the DB.

## 5. Endpoint contract

```
POST /issues/:id/review
Content-Type: application/json
body: {
  decision: 'resolve' | 'escalate' | 'hold',
  justification: string (min 1),
  reviewer: string (min 1)
}
```

Responses:

| Status | When |
|---|---|
| `200` | success — returns the updated issue |
| `400` | malformed JSON or body fails validation (`ZodError`) |
| `404` | issue id/external_id not found (`NotFoundError`) |
| `409` | illegal transition for the issue's current status (`ConflictError`) |

`:id` accepts a uuid or an upstream `external_id`, consistent with the existing
`GET /issues/:id` (reuses `findByIdOrExternalId`).

The resolver follows the module convention: validate body → fetch issue (404) →
compute target with `nextStatusFor` (409 if illegal) → call the repository →
`res.status(200).json(updatedIssue)`. All errors forwarded via `next(err)`; the
central handler owns the mapping. The new `ConflictError → 409` mapping already
exists.

## 6. Repository — transactional `recordReview`

Per `apps/api/AGENTS.md`, multi-step/transactional work lives in the repository.
`issuesRepository.recordReview(issueId, { decision, target, justification,
reviewer })` runs one transaction:

1. `insert issue_decisions` (actor `'human'`) → returns `decisionId`
2. `insert issue_status_history` (`from = current`, `to = target`, actor
   `'human'`, `decision_id = decisionId`)
3. `update issues set status = target where id = ...`
4. return the updated issue row

If any step fails the whole transaction rolls back, so a decision is never
recorded without its matching status change and vice-versa.

## 7. Read path

`GET /issues/:id` is extended to embed the audit trail so the recorded data has a
read path:

```jsonc
{
  ...issue,
  "status_history": [ { "from_status": null, "to_status": "pending", "actor": "system", "at": "..." }, ... ],
  "decisions":      [ { "actor": "human", "decision": "escalate", "justification": "...", "decided_by": "...", "at": "..." }, ... ],
  "timeline":       [ /* merged chronological projection of the two above */ ]
}
```

`GET /issues` (the list) is unchanged — it stays a lightweight collection view.

## 8. Data flow

```
POST /issues/:id/review
  → validate body (reviewSchema)                     [400 on failure]
  → issuesRepository.findByIdOrExternalId(:id)       [404 if absent]
  → nextStatusFor(issue.status, body.decision)       [409 if illegal]
  → issuesRepository.recordReview(...)  (1 txn: decision + history + status flip)
  → 200 updated issue

GET /issues/:id
  → issue + status_history[] + decisions[] + derived timeline[]
```

## 9. Testing (TDD, one vertical slice per commit)

Tests exercise the HTTP surface (per `apps/api/AGENTS.md`), plus one pure-unit
test for the state machine. Each starts from a pristine DB.

1. `nextStatusFor` unit test — the full legal/illegal matrix (pure, no HTTP/DB).
2. review happy path, per verb: `resolve` / `escalate` / `hold` → `200`, issue
   status flipped, one `issue_decisions` row and one `issue_status_history` row
   written (with `decision_id` linked).
3. `404` unknown id.
4. `409` illegal transitions: review a `resolved` issue; `escalate` an
   `escalated` issue; any verb on a `pending` issue.
5. `400` missing/empty `justification`.
6. intake history row: `POST /issues` writes a `null → pending`, actor `system`
   row.
7. read path: `GET /issues/:id` returns embedded `status_history`, `decisions`,
   and the merged `timeline`.
8. extend the `test/setup.ts` truncate hook to cover `issue_decisions` and
   `issue_status_history`.

## 10. Files touched (anticipated)

- `apps/api/src/modules/issues/model.ts` — `on_hold` enum value; two new tables.
- `apps/api/src/modules/issues/schema.ts` — `reviewSchema`.
- `apps/api/src/modules/issues/state-machine.ts` (new) — `nextStatusFor` + map.
- `apps/api/src/modules/issues/repository.ts` — `recordReview` (txn), embedded
  reads for `findByIdOrExternalId`, intake history on `create`.
- `apps/api/src/modules/issues/resolvers/review-issue-resolver.ts` (new) +
  barrel; `get-issue-resolver.ts` (embed trail); `create-issue-resolver.ts`
  unchanged if the intake write moves into the repository.
- `apps/api/src/modules/issues/routes.ts` — `POST /:id/review`.
- `apps/api/src/modules/issues/types.ts` — inferred row types for the new tables.
- Drizzle migration for the enum value + two tables.
- `apps/api/test/setup.ts` — truncate the two new tables.

Built TDD, one slice at a time, per the repo `AGENTS.md`.
