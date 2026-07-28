# Design — `GET /issues` filtering + `GET /issues/:id` (second API slice)

- **Date:** 2026-07-27
- **Status:** Approved for planning
- **Area:** `apps/api`
- **Depends on:** `2026-07-27-issues-persistence-create-list-design.md` (the
  `issues` table, module, repository, and `POST`/`GET` list endpoints it stood
  up)
- **Forward-compatible with:** `2026-07-27-ai-decisioning-layer-design.md` and
  the future `POST /issues/:id/review` slice (both read whole issue rows; nothing
  here blocks them)

## 1. Context & goal

The first API slice delivered `POST /issues` (persist) and `GET /issues` (list,
newest-first). This slice completes the **read** surface of the backend:

- **Upgrade `GET /issues`** with status filtering.
- **Add `GET /issues/:id`** to fetch a single issue's status and details.

With these in place, the only remaining backend endpoint is
`POST /issues/:id/review` (its own later slice).

Scope is deliberately narrow — read-only additions on top of the existing
module. **No schema/enum migration**: the `status` enum
(`pending | processing | resolved | escalated`) is untouched.

**Out of scope this slice (all later):** `POST /issues/:id/review`, the
status-history / decisions / customer / transaction tables, the job queue, and
the AI harness.

## 2. Decisions (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Keep the current 4-value `status` enum** (`pending`, `processing`, `resolved`, `escalated`); no lane/team axis, no richer lifecycle | Scope is the **agent's** action space, not a full ops workflow. A richer 8-state, two-lane model (informed by the pre-existing UI) was considered and rejected as over-engineering for this exercise — the doc names the flow `pending → processing → resolved` plus escalate, and warns against over-engineering. |
| 2 | **`GET /issues/:id` accepts *either* the uuid `id` or the `external_id`** (e.g. `iss_001`) | From the ingest-then-find perspective, an operator may hold either identifier. The uuid is what `POST` returns; the `external_id` is the human-meaningful source id. Supporting both keeps the lookup contract forgiving without ambiguity (see #3). |
| 3 | **Disambiguate by shape, and branch the query — never OR both columns** | A uuid-shaped param is looked up by `id`; anything else by `external_id`. We must branch *before* querying: Postgres would try to cast a non-uuid value (`iss_001`) to `uuid` for the `id` comparison and raise a type error. `external_id`s in the data are not uuid-shaped, so there is no collision. |
| 4 | **`status` filter is comma-separated, OR semantics** (`?status=pending,processing`) | One call can answer "everything in these states." Absent param = no filter (all issues). |
| 5 | **Invalid / empty `status` value → `400`** (Zod-validated against the enum) | Consistent with how request bodies are validated; a client typo (`?status=banana` or `?status=`) fails loudly instead of silently returning `[]`. |
| 6 | **Not-found on `GET /issues/:id` → `404`** via `NotFoundError` | Reuses the existing central error mapping; resolvers never translate errors inline. |
| 7 | **List ordering unchanged**: `orderBy(desc(ingestedAt))` whether or not a filter is applied | Newest-first stays the stable contract from slice 1. |

## 3. `GET /issues` — status filtering

### Contract

| Request | Result |
|---|---|
| `GET /issues` | `200` — all issues, newest-first (unchanged) |
| `GET /issues?status=pending` | `200` — issues with that status |
| `GET /issues?status=pending,processing` | `200` — issues matching **any** listed status |
| `GET /issues?status=banana` | `400` — unknown status value |
| `GET /issues?status=` | `400` — empty value |

### Implementation

- **`schema.ts` — `listIssuesQuerySchema`**: parses `req.query`. The `status`
  key (optional) is split on `,`, each part validated against
  `z.enum(["pending", "processing", "resolved", "escalated"])`. Yields
  `{ statuses: IssueStatus[] | undefined }`. A bad value throws `ZodError`, which
  the central handler maps to `400`. Deriving the enum values from the single
  source (the model's `issueStatus` enum) is preferred over re-typing the
  literals, to avoid drift.
- **`listIssuesResolver`**: `const { statuses } = listIssuesQuerySchema.parse(req.query)`,
  then `res.status(200).json(await issuesRepository.list({ statuses }))`. Keep
  the existing `try/catch → next(err)` wrapper.
- **`issuesRepository.list(filters?)`**: signature becomes
  `list(filters?: { statuses?: IssueStatus[] })`. When `statuses` is present and
  non-empty, add `.where(inArray(issues.status, statuses))`; always
  `.orderBy(desc(issues.ingestedAt))`.

## 4. `GET /issues/:id` — fetch one (by uuid or external_id)

### Contract

| Request | Result |
|---|---|
| `GET /issues/<uuid>` | `200` — the issue looked up by `id` |
| `GET /issues/iss_001` | `200` — the issue looked up by `external_id` |
| `GET /issues/<unknown>` | `404` — `NotFoundError` |

### Implementation

- **`issuesRepository.findByIdOrExternalId(idOrExternalId: string)`**: returns
  `IssueRow | undefined`. Branch on
  `z.uuid().safeParse(idOrExternalId).success` (Zod 4 top-level format API — the
  repo avoids the deprecated `z.string().uuid()`):
  - success → `db.select().from(issues).where(eq(issues.id, idOrExternalId))`
  - otherwise → `... .where(eq(issues.externalId, idOrExternalId))`

  Return the first row (or `undefined`).
- **`resolvers/get-issue-resolver.ts` — `getIssueResolver`**
  (`Request<{ id: string }>`): call the repo; if `undefined`, throw
  `new NotFoundError(\`issue ${req.params.id} not found\`)`; else
  `res.status(200).json(found)`. Standard `try/catch → next(err)`. Add it to
  `resolvers/index.ts`.
- **`routes.ts`**: `issuesRouter.get("/:id", resolvers.getIssueResolver)`,
  mounted **after** `get("/")` so `/issues` is not captured by `/:id`.

## 5. Tests (TDD — HTTP-level, one failing test per cycle)

Per the house convention, tests exercise the module through HTTP and start from a
pristine DB. New/extended files under `modules/issues/__tests__/`:

- **`list-issues.api.test.ts`** (extend):
  - `?status=pending` returns only pending rows.
  - `?status=pending,processing` returns the union of both.
  - `?status=banana` → `400`.
- **`get-issue.api.test.ts`** (new):
  - `GET /issues/<uuid returned by POST>` → `200`, correct row.
  - `GET /issues/iss_001` (the `external_id`) → `200`, same row.
  - `GET /issues/<unknown>` → `404`.
- **`schema.test.ts`** (extend, optional): unit-level `listIssuesQuerySchema`
  parsing — single value, comma-separated, invalid → throws.

## 6. Files touched

| File | Change |
|---|---|
| `src/modules/issues/schema.ts` | add `listIssuesQuerySchema` (+ inferred type) |
| `src/modules/issues/repository.ts` | `list(filters?)` gains `inArray` where-clause; add `findByIdOrExternalId` |
| `src/modules/issues/resolvers/list-issues-resolver.ts` | parse query, pass `statuses` to repo |
| `src/modules/issues/resolvers/get-issue-resolver.ts` | **new** resolver |
| `src/modules/issues/resolvers/index.ts` | export `getIssueResolver` |
| `src/modules/issues/routes.ts` | mount `GET /:id` after `GET /` |
| `src/modules/issues/__tests__/list-issues.api.test.ts` | filter cases |
| `src/modules/issues/__tests__/get-issue.api.test.ts` | **new** tests |

No migration, no new dependencies, no changes outside `src/modules/issues/`.
