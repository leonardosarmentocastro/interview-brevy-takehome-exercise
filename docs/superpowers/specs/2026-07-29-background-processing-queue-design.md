# Design — background processing & job queue

- **Date:** 2026-07-29
- **Status:** Approved for planning
- **Area:** `apps/api`
- **Depends on:** the issues module (create / list / get / review) — already built
- **Feeds:** `2026-07-27-ai-decisioning-layer-design.md` (the next cycle)

## 1. Goal

Issues must not be processed inside an API request. This cycle builds the
machinery that picks an issue up after it lands, runs it through a processing
step, and records the outcome — with retries, backoff, idempotency, and
crash-safety.

**This cycle deliberately contains no AI.** The processing step is a seam
(`decide()`) whose v1 implementation returns "a human should look at this."
Every issue therefore flows intake → queue → worker → `needs_review`, and the
existing `POST /issues/:id/review` resolves it. The pipeline is real end to end;
only the intelligence is absent. The AI cycle swaps one function.

## 2. Two systems, not one

The requirement was framed as "poll issues from an external system and store
them in a queue." That framing hides a bug, so the design separates it:

- **Ingestion** — external source → *our Postgres*. Concerns: cadence, dedupe.
- **Processing** — an issue already in Postgres → the decision pipeline.
  Concerns: claim, retry, backoff, lease, idempotency.

Postgres is the system of record. **The queue holds job references
(`{ issueId }`), never issue payloads.** If issues lived in the queue, "can be
stopped and restarted without losing work" would become a question about queue
durability rather than about the database. `issue_status_history` already *is*
the durable work log; the queue is a scheduler on top of it.

## 3. Substrate: Graphile Worker

Postgres-backed (`graphile-worker@0.17.x`), not Redis/BullMQ.

**The load-bearing reason: enqueue must be atomic with the issue INSERT.**
Postgres + Redis is a dual-write — crash between the two commits and the issue
sits in `pending` forever with no job, requiring a transactional outbox or a
reconciliation sweeper to paper over. `graphile_worker.add_job` is a SQL
function callable inside an existing transaction, so that failure mode does not
exist by construction.

Supporting reasons:

| Need | Provided by |
|---|---|
| Claim without double-processing | `SELECT … FOR UPDATE SKIP LOCKED` internally |
| Low-latency pickup | `LISTEN`/`NOTIFY` — no poll delay |
| Retries with exponential backoff | built in, fixed curve `exp(least(10, attempt))` seconds |
| Crash recovery | job lease expiry |
| Job dedupe | `job_key_mode := 'unsafe_dedupe'` |
| Scheduled ingestion | built-in crontab |
| Synchronous drain for tests | `runOnce()` |

The workload is AI-API-bound — roughly 0.12 jobs/sec at 10,000 issues/day — so
Redis would buy throughput that is never needed at the cost of the consistency
that is.

**Alternatives considered.** A hand-rolled `SKIP LOCKED` table: rejected because
the genuinely interesting logic (error taxonomy, dead-lettering into a human
lane, handler idempotency) is hand-written either way, so hand-rolling the
mechanics only spends time that Part 2 needs. `pg-boss`: equivalent on the
transactional-enqueue axis; Graphile Worker was preferred for built-in cron and
`job_key` dedupe. BullMQ: rejected on the dual-write problem, and because
attempt history would live in Redis, separate from the Postgres audit trail.

**Honest cost:** version `0.17.x` is pre-1.0 despite years of production use;
and Graphile Worker owns its own Postgres schema with its own migrations,
running alongside Drizzle. No collision (separate schema), but the test harness
must install it.

## 4. Topology

Two processes, one database.

```
┌─────────────┐        ┌──────────────────── Postgres ────────────────────┐
│  api        │        │                                                   │
│  (express)  │───────▶│  issues, issue_status_history, issue_decisions     │
│  :3333      │        │      business state / audit trail (permanent)      │
└─────────────┘        │                                                   │
                       │  graphile_worker.*                                │
┌─────────────┐        │      operational state (archived)                 │
│  worker     │◀──────▶│                                                   │
└─────────────┘ LISTEN └───────────────────────────────────────────────────┘
   ├── crontab:  */1 * * * * ingest_issues
   ├── task:     ingest_issues
   └── task:     process_issue
```

Separate entrypoints so the worker can be killed independently of the API —
that is what makes crash-recovery an observable behaviour rather than a claim.

### Flow

```
 crontab tick ─────────┐
 POST /issues ─────────┤──▶ ingestIssue(tx, raw)
 pnpm seed ────────────┘      │
                              │  ONE TRANSACTION
                              │  INSERT issues (pending) ON CONFLICT (external_id) DO NOTHING
                              │  INSERT issue_status_history (→ pending)
                              │  add_job('process_issue', {issueId},
                              │          job_key := issueId, job_key_mode := 'unsafe_dedupe')
                              ▼
                    LISTEN/NOTIFY wakes the worker
                              ▼
                    process_issue(issueId)
                      1. entry guard: already finished? → no-op
                      2. pending → processing (recorded once)
                      3. decide()          ← the seam; v1 stub
                      4. apply outcome in one transaction
```

**No insert → no enqueue.** `ON CONFLICT DO NOTHING` returns zero rows for a
known `external_id`, so the enqueue is skipped. Intake dedupe and job dedupe are
the same line of code, and re-running the cron over the same 5-row file forever
is a no-op.

## 5. Correctness: lease vs. status

The tempting claim guard is
`UPDATE issues SET status='processing' WHERE id=? AND status='pending'`, reading
"0 rows affected" as "someone else has it." **That is wrong here.** If a worker
flips an issue to `processing` and is then killed, the lease expires and the job
retries — but the guard now matches nothing, the handler concludes "already
claimed," and **the issue is silently abandoned forever.**

Each concern belongs to a different mechanism:

| Concern | Owner |
|---|---|
| Only one worker runs a given job at a time | the **job lease** (Graphile Worker) |
| `pending → processing` recorded exactly once | conditional transition — skip the history write if already `processing` |
| An outcome is never applied twice | the **entry guard**, `hasLeftTheQueue()` |

`hasLeftTheQueue(status)` is true for every status except `pending` and
`processing` — i.e. `needs_review`, `resolved`, `escalated`, `on_hold`. The
handler opens by returning early when it holds. This covers the nastiest window:
the outcome transaction commits, the process dies before Graphile marks the job
complete, and the job retries against finished work.

## 6. Schema delta

Additive, in the style of the existing `on_hold` migration:

1. **`issue_status` += `needs_review`**
2. **`state-machine.ts`** accepts `needs_review` as a legal `from` for
   `resolve` / `escalate` / `hold`.

That is the entire delta. No `confidence` column, no new tables.

Note that `state-machine.ts` governs **human review verbs only** — it maps a
`ReviewDecision` to a target status. The worker's `processing → needs_review`
move is a *system* transition and does not pass through it; the worker writes
that transition directly via the repository with `actor: 'system'`. Keeping the
two separate avoids inventing a fake review verb for the machine to consume.

`needs_review` earns its place on the dead-letter argument alone, independent of
whether AI ever ships: an issue whose processing permanently fails cannot stay
in `processing`, because nobody is looking there. Reusing `on_hold` was
considered and rejected — `on_hold` means a human deliberately paused something,
and an exhausted job was not paused by anyone.

## 7. Components

```
src/queue/
  runner.ts             # graphile-worker run() config, assembles taskList
  enqueue.ts            # enqueue(tx, name, payload, opts) → SQL add_job
  retry-policy.ts       # RetryableError / TerminalError, isRetryable, MAX_ATTEMPTS
  __tests__/retry-policy.test.ts

src/modules/issues/
  ingest.ts             # ingestIssue(tx, raw) — the single door
  decide.ts             # the seam; v1 stub + DECIDE_MODE fault injection
  sources/file-source.ts # fetchIssues() over payment_issues.json
  tasks/
    ingest-issues.ts
    process-issue.ts
    index.ts            # barrel, mirrors resolvers/index.ts
  __tests__/…

src/worker/start.ts     # second entrypoint
crontab                 # */1 * * * * ingest_issues
```

Graphile Worker is a **driver** in `src/queue/`; task handlers live with the
domain they serve, per the module conventions in `apps/api/AGENTS.md`.

### Transactional enqueue

The one piece that must be exactly right. The JS `addJob` helper uses its own
pool, which would reintroduce the dual-write problem. Call the SQL function on
the Drizzle transaction's connection instead:

```ts
export const enqueue = (tx: Tx, name: string, payload: object, opts: EnqueueOpts) =>
  tx.execute(sql`
    select graphile_worker.add_job(
      ${name},
      payload      := ${JSON.stringify(payload)}::json,
      max_attempts := ${opts.maxAttempts},
      job_key      := ${opts.jobKey},
      job_key_mode := 'unsafe_dedupe'
    )`);
```

### The single door

```ts
export const ingestIssue = async (tx: Tx, raw: RawIssue): Promise<IssueRow | null> => {
  const created = await issuesRepository.insertIfNew(tx, toIssueRow(raw));
  if (!created) return null;                    // already known → no job
  await enqueue(tx, "process_issue", { issueId: created.id },
                { jobKey: created.id, maxAttempts: MAX_ATTEMPTS.processIssue });
  return created;
};
```

The cron task, `POST /issues`, and `pnpm seed` all call this. A webhook would be
a fourth caller with no change to the function — noted as a seam, not built.

## 8. Retry budget

`max_attempts` defaults to 25. With the fixed `exp(least(10, attempt))` curve
plateauing at ~6h07m, 25 attempts spans days — an issue would sit invisible for
a week. The budget is therefore a real decision, computed from the failure being
defended against: *"what happens if the AI API is down for more than an hour?"*

| attempt | delay | cumulative |
|---|---|---|
| 1 | 2.7s | 2.7s |
| 2 | 7.4s | 10s |
| 3 | 20s | 30s |
| 4 | 55s | 1m25s |
| 5 | 2m28s | 3m53s |
| 6 | 6m43s | 10m36s |
| 7 | 18m17s | 28m53s |
| 8 | 49m41s | **1h18m** |

**`max_attempts: 8`** buys ~1h18m of outage tolerance for 8 API calls, then hands
the issue to a human. Attempt 9 would push the total to ~3h33m — too long to
leave a payment issue unattended.

`ingest_issues` gets **`max_attempts: 1`**: the crontab fires every minute and
ingestion is idempotent, so the next tick *is* the retry.

Concurrency is left at the library default. Tuning it against a rate limit is
deferred to the cycle that introduces a rate limit.

## 9. Error handling

### Taxonomy

The queue layer defines its own error types and knows nothing about any AI SDK:

```ts
// queue/retry-policy.ts
export class RetryableError extends Error {}   // transient — try again
export class TerminalError extends Error {}    // pointless to retry

export const isRetryable = (err: unknown) => err instanceof RetryableError;
```

Unknown errors are **terminal, not retryable**. A bug in our own code should not
burn 8 API calls across 78 minutes before anyone notices; it should surface on
attempt 1. Default-deny is the right bias when the retryable set is enumerable
and the failure set is not.

The AI cycle adds a `mapAnthropicError()` beside `decide()` that classifies 429 /
5xx / timeouts as `RetryableError` and 400 / 401 as `TerminalError`.
`retry-policy.ts` never learns what Anthropic is.

### The handler

```ts
export const processIssue = async ({ issueId }, helpers) => {
  const issue = await issuesRepository.findById(issueId);
  if (!issue) return;                             // deleted — nothing to do
  if (hasLeftTheQueue(issue.status)) return;      // entry guard (§5)

  await issuesRepository.beginProcessing(issue);  // pending→processing, once

  try {
    await decide(issue, { signal: helpers.abortSignal });
  } catch (err) {
    const lastChance = helpers.job.attempts >= MAX_ATTEMPTS.processIssue;
    if (isRetryable(err) && !lastChance) throw err;                   // → backoff
    await issuesRepository.routeToHumanLane(issue, reasonFrom(err));  // → needs_review
    return;                                                           // job SUCCEEDS
  }

  await issuesRepository.routeToHumanLane(issue, "awaiting human decision");
};
```

**The dead letter is a human lane, not a void.** Graphile Worker's only failure
contract is *"throw = retry"* — there is no "fail permanently now" signal. So the
only way to reach a terminal outcome is to deliberately *not* throw: swallow the
error, move the issue to `needs_review` with the reason recorded in
`issue_status_history`, and report the job successful. A job row in a failed
state is something nobody looks at; an issue in an operator's lane gets worked.

The `lastChance` check is why `helpers.job.attempts` matters. Without it, a
retryable error that exhausts its budget lets Graphile mark the job permanently
failed — stranding the issue in `processing`, invisible. Same bug as §5,
arriving by a different road.

### v1 writes no decision row

The outcome is the **status transition only** — `processing → needs_review`,
`actor: 'system'`. No `issue_decisions` insert, because there is no agent and
"stub, no AI configured" is not a decision. The decisions table stays empty
until something actually decides. Human decisions already exercise that write
path via `recordReview`, so nothing goes untested.

### Graceful shutdown

`helpers.abortSignal` is threaded into `decide()`, so `SIGTERM` aborts in-flight
work, the lease releases, and a restarted worker resumes. The v1 stub honours the
signal so this is demonstrable before any AI exists.

### Fault injection

`decide()` reads `DECIDE_MODE` — test and demo scaffolding, marked as such:

| value | behaviour |
|---|---|
| `stub` (default) | routes to `needs_review` |
| `slow` | delays, honouring `abortSignal` — for the crash-recovery demo |
| `fail_retryable` | throws `RetryableError` |
| `fail_terminal` | throws `TerminalError` |

## 10. Failure modes

| If this happens… | What the system does | Where |
|---|---|---|
| Worker killed mid-processing | In-flight work is cancelled, the job's lock releases, a restarted worker picks the same issue back up. No work lost. | `tasks/process-issue.ts` |
| Worker saves a result, then dies before marking the job done | The job runs again; the entry guard sees the issue already finished and exits. **Never decided twice.** | `tasks/process-issue.ts` |
| Issue saved but the app crashes before queueing it | Cannot happen — save and enqueue are one transaction. | `modules/issues/ingest.ts` |
| Processing fails transiently for under an hour | Retries 8 times with growing gaps totalling ~1h18m; resumes if the dependency recovers. | `queue/retry-policy.ts` |
| Processing fails for more than an hour | Gives up at ~1h18m and puts the issue in an operator's review lane. Degrades to manual — never silently stuck. | `queue/retry-policy.ts` |
| A non-transient failure (bad config, bad request) | Fails on the first attempt rather than burning 8 calls over an hour. | `queue/retry-policy.ts` |
| The same issue arrives twice | The second is ignored — the source ID is unique, and no insert means no job. | `modules/issues/ingest.ts` |
| The same issue is queued twice | `job_key_mode := 'unsafe_dedupe'` collapses it. | `queue/enqueue.ts` |
| Two workers grab the same job | Postgres row locking hands it to exactly one. | Graphile Worker |
| Cron fires on several worker replicas | First to queue wins; the rest no-op, guaranteed by ACID. | Graphile Worker |

## 11. Tests

TDD vertical slices per the root `AGENTS.md`; tests in `__tests__/` beside the
code under test. Mapping the assignment's three required tests:

**1. API endpoint.** `POST /issues` enqueues exactly one job with
`job_key = issue.id`; a duplicate `external_id` enqueues none. Asserted through
HTTP plus a job-table read.

**2. Queue retry / failure handling.**
- `isRetryable` — unit test per error type, including the unknown-error default.
- A retryable failure mid-budget → the job's `attempts` incremented, `run_at`
  moved into the future, and the issue still `processing` (**not stranded**).
- A retryable failure at `attempts = 8` → the issue is `needs_review`, a
  `status_history` row records the reason, and the job did **not** fail.

**No fake timers.** Assert against the job row's `attempts` / `run_at` columns
rather than waiting real seconds; sleeping through a backoff curve is how these
suites become slow and flaky.

**3. Edge case — the crash-after-commit window.** Run `process_issue` to
completion, then invoke the identical payload again. Assert exactly one terminal
transition and that `decide()` was called once. This is the entry guard, and it
is the most interesting failure in the system.

**Harness.** Tasks are tested by calling the task function directly with a fake
`helpers` (`{ job: { attempts }, abortSignal, logger }`) — fast and
deterministic, no runner. One end-to-end test boots the real runner via
`runOnce()` to prove the wiring. `test/global-setup.ts` calls `runMigrations()`
to install the worker schema; the `test/setup.ts` truncate hook extends to the
worker's job table (the internal table name is version-specific in 0.17 —
confirm against the installed schema rather than hardcoding it).

## 12. README

The README is rewritten **backend-first**; `apps/web` is de-emphasised. It must
cover, for an engineer who has never seen this repo:

1. What the service is
2. Architecture diagram (§4)
3. End-to-end narrative of one issue, with file pointers at each hop
4. Where state lives — business tables vs. the worker's operational tables
5. Setup and how to run the API and worker
6. **Manual test scenarios** (§13)
7. Failure modes (§10), in plain language with file references
8. The three required trade-off essays: schema at 10k/day; queue crash +
   dependency down for more than an hour; agent architecture
9. What I would do differently

## 13. Manual test scenarios

Each demonstrates one claim. The README carries exact `curl` / `psql` commands.

| # | Scenario | Run | Expect |
|---|---|---|---|
| 1 | Happy path | `db:up`, `db:migrate`, start api + worker | Cron ingests 5 issues within a minute; `GET /issues` shows all 5 in `needs_review` |
| 2 | Idempotency | Let several cron ticks pass | Still exactly 5 issues; no duplicate jobs |
| 3 | Crash recovery | `DECIDE_MODE=slow`, kill the worker mid-issue, restart | Issue resumes and completes. Nothing lost, nothing decided twice |
| 4 | Retry with backoff | `DECIDE_MODE=fail_retryable`, watch the job row | `attempts` climbs 1→2→3; `run_at` pushes further out each time |
| 5 | Exhaustion → human lane | Leave scenario 4 running | Issue lands in `needs_review` with the reason in its history; the job is not left failed |
| 6 | Human review loop | `POST /issues/:id/review`, then `GET /issues/:id` | Status flips; audit trail shows intake → processing → needs_review → resolved with the decision attached |

## 14. Explicitly out of scope

Deferred to the AI cycle, and deliberately not built now:

- Any Anthropic SDK dependency, prompt assembly, or `policies.md` reading
- `confidence` on `issue_decisions`, and confidence-based routing
  (≥90 / 70–89 / <70) — it cannot be built or tested without a real confidence
  value
- The citation guardrail ("no citation → no execution") from
  `2026-07-27-ai-decisioning-layer-design.md` §4.1 — it belongs where `trace[]`
  exists
- Splitting `process_issue` into `decide_issue` + `execute_action`. The split is
  right once actions move money, because their retry semantics diverge sharply;
  it buys nothing while `decide()` is a stub.
- Any money-moving action execution, and its idempotency keys
- A webhook intake route, and a durable ingestion cursor (the full re-scan is
  idempotent; production needs a watermark because it cannot re-fetch all
  history each minute)
