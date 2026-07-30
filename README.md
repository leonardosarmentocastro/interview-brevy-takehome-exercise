# Payment Issue Processing Service

A backend service that takes payment exceptions from an upstream BNPL / payments
platform (declines, expired cards, missed installments, disputes, refunds),
stores them in Postgres, and runs each one through a durable job queue into a
decision pipeline. Every status change is audited. A human review endpoint
resolves what the pipeline cannot.

A Next.js UI exists under `apps/web`; this README is about the API and worker.

## Architecture

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
   ├── crontab:  * * * * * ingest_issues ?max=1
   ├── task:     ingest_issues
   └── task:     process_issue
```

```
 crontab tick ─────────┐
 POST /issues ─────────┤──▶ ingestIssue(raw)
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

## How one issue travels the system

1. **Cron pulls the feed** — `apps/api/src/modules/issues/tasks/ingest-issues.ts`
   reads the bundled `payment_issues.json` via the file source and calls
   `ingestIssue` once per row.
2. **Insert + enqueue as one unit** — `apps/api/src/modules/issues/ingestion/ingest.ts`
   opens a transaction, inserts the issue if its `external_id` is new, and
   enqueues a `process_issue` job. No insert means no job (re-reads are free).
3. **Transactional enqueue** — `apps/api/src/queue/enqueue.ts` calls
   `graphile_worker.add_job` on the same connection as the insert, so a
   crash cannot leave an issue without a job.
4. **Worker claims the job** — `apps/api/src/modules/issues/tasks/process-issue.ts`
   loads the issue, returns early if it has already left the queue, flips
   `pending → processing`, and calls `decide()`.
5. **Outcome** — v1's `decide()` stub always succeeds, so the handler parks the
   issue in `needs_review` via `apps/api/src/modules/issues/repository.ts`
   (`parkForHumanReview`, `actor: 'system'`). A human finishes it with
   `POST /issues/:id/review`.

## Where state lives

| Kind | Tables | Lifetime |
| --- | --- | --- |
| Business state | `issues`, `issue_status_history`, `issue_decisions` | Permanent audit trail |
| Operational state | `graphile_worker.*` | Ephemeral — jobs are archived/removed once done |

Postgres is the system of record. The queue holds only job references
(`{ issueId }`), never issue payloads. If the issue lived in the queue,
"survive a restart" would be a queue-durability question; with this design it
is already answered by the database.

## Setup

```bash
pnpm install
pnpm --filter api db:up
pnpm --filter api db:migrate
```

Then in separate terminals:

```bash
pnpm --filter api worker          # crontab + process_issue
pnpm --filter api dev             # HTTP API on :3333
```

Optional one-shot seed (same door as the cron):

```bash
pnpm --filter api seed
```

## Try it yourself

### 1. Happy path

```bash
pnpm --filter api db:up && pnpm --filter api db:migrate
pnpm --filter api worker          # terminal 1
pnpm --filter api dev             # terminal 2
curl -s localhost:3333/issues | jq '.[] | {external_id: .externalId, status}'
```

Within a minute the cron ingests all 5 issues and the worker moves each to
`needs_review`.

### 2. Idempotency

```bash
pnpm --filter api seed
pnpm --filter api seed            # run it again
curl -s localhost:3333/issues | jq 'length'     # still 5
```

The second run prints `skip (already exists)` for every issue and queues nothing.

### 3. Crash recovery

```bash
DECIDE_MODE=slow pnpm --filter api worker       # terminal 1
pnpm --filter api seed                          # terminal 2
# Ctrl-C the worker while an issue is mid-flight, then restart it:
pnpm --filter api worker
```

The job's lock expires, the restarted worker picks the same issue back up, and
it completes exactly once.

### 4. Retry with backoff

```bash
DECIDE_MODE=fail_retryable pnpm --filter api worker
```

Watch the attempt counter climb and the next run time push further out:

```bash
watch -n5 'docker compose -f apps/api/docker-compose.yml exec -T postgres \
  psql -U brevy -d brevy -c \
  "SELECT task_identifier, attempts, run_at, last_error FROM graphile_worker.jobs"'
```

### 5. Exhaustion lands in a human lane

Leave scenario 4 running. After 8 attempts (~1h18m — or edit
`MAX_ATTEMPTS.processIssue` in `src/queue/retry-policy.ts` to shorten it):

```bash
curl -s localhost:3333/issues?status=needs_review | jq 'length'
```

The issue is in `needs_review` with the failure in its history, and the job row
is gone rather than left permanently failed.

### 6. Human review loop

```bash
ID=$(curl -s localhost:3333/issues | jq -r '.[0].id')
curl -s -X POST localhost:3333/issues/$ID/review \
  -H 'content-type: application/json' \
  -d '{"decision":"resolve","justification":"retried on a new card","reviewer":"ops@brevy.com"}'
curl -s localhost:3333/issues/$ID | jq '.status, .timeline'
```

The status flips to `resolved` and the timeline shows the full journey:
intake → processing → needs_review → resolved, with the decision attached.

## Failure modes

| If this happens… | What the system does | Where |
|---|---|---|
| Worker killed mid-processing | In-flight work is cancelled, the job's lock releases, a restarted worker picks the same issue back up. No work lost. | `tasks/process-issue.ts` |
| Worker saves a result, then dies before marking the job done | The job runs again; the entry guard sees the issue already finished and exits. **Never decided twice.** | `tasks/process-issue.ts` |
| Issue saved but the app crashes before queueing it | Cannot happen — save and enqueue are one transaction. | `modules/issues/ingestion/ingest.ts` |
| Processing fails transiently for under an hour | Retries 8 times with growing gaps totalling ~1h18m; resumes if the dependency recovers. | `queue/retry-policy.ts` |
| Processing fails for more than an hour | Gives up at ~1h18m and puts the issue in an operator's review lane. Degrades to manual — never silently stuck. | `queue/retry-policy.ts` |
| A non-transient failure (bad config, bad request) | Fails on the first attempt rather than burning 8 calls over an hour. | `queue/retry-policy.ts` |
| The same issue arrives twice | The second is ignored — the source ID is unique, and no insert means no job. | `modules/issues/ingestion/ingest.ts` |
| The same issue is queued twice | `job_key_mode := 'unsafe_dedupe'` collapses it. | `queue/enqueue.ts` |
| Two workers grab the same job | Postgres row locking hands it to exactly one. | Graphile Worker |
| Cron fires on several worker replicas | First to queue wins; the rest no-op, guaranteed by ACID. | Graphile Worker |

## Trade-offs and decisions

### Database schema

Payment issues share a common head (`external_id`, `type`, `status`, amounts,
timestamps) and a type-specific tail. The type-specific fields live in a
`metadata` JSONB column rather than a table per type. That keeps list/filter
queries simple and intake uniform; the cost is that JSONB fields are not
first-class columns until a concrete type earns one. Append-only
`issue_status_history` and `issue_decisions` tables are the audit trail —
nothing is overwritten, so "what happened?" is a query, not a reconstruction.

At 10,000 issues/day the hot path stays fine on a single Postgres primary, but
three things earn attention: an index on `issues(status, ingested_at)` for the
operator board, partitioning or archiving `issue_status_history` once it
outgrows the working set, and a read replica for list queries so review traffic
does not contend with intake writes.

### Queue design

Mutual exclusion belongs to the **job lease**, not to a
`UPDATE … WHERE status='pending'` claim. If a worker flips an issue to
`processing` and dies, a status-based claim would see "already claimed" on
retry and strand the issue forever. The entry guard
(`hasLeftTheQueue`) closes a different window: outcome commits, process dies
before the job is marked complete, job retries against finished work — without
the guard the issue would be decided twice.

If the AI provider is down for more than an hour, eight attempts with Graphile
Worker's fixed exponential backoff span ~1h18m, then the handler *does not
throw*: it parks the issue in `needs_review` with the reason recorded. Graphile
has no "fail permanently" signal; a failed job row is invisible to operators, so
the dead letter is a human lane.

Enqueue is a SQL `add_job` inside the caller's transaction. Redis/BullMQ was
rejected because a crash between the issue INSERT and the Redis write strands
an issue with no job — a dual-write that needs an outbox or sweeper. Postgres
makes that failure mode impossible by construction.

### Agent architecture

This cycle ships a `decide()` seam whose v1 body is a stub: every successfully
processed issue lands in `needs_review` for a human. That is deliberate — the
pipeline (intake, queue, retry, crash recovery, audit) is real end to end, and
the next cycle swaps one function for an LLM call without touching the queue
layer. Fabricating a fake verdict would have tested nothing about intelligence
and lied about what the system decided.

The planned AI layer (see
`docs/superpowers/specs/2026-07-27-ai-decisioning-layer-design.md`) uses the
LLM as the decider: `policies.md` plus the issue JSON in, a structured
`Decision` (verdict, cited `trace[]`, actions) out, with guardrails (citation
required before execution, structured output, temperature 0). A single general
agent is preferred over specialised per-type agents for v1 — one prompt, one
schema, one place to tighten policy — with specialised agents deferred until a
type's failure mode clearly diverges (e.g. money-moving refunds vs. soft
retries).

## What I'd do differently

1. **Put a real model behind `decide()`** — the seam is ready; the missing
   piece is prompt assembly + Anthropic (or equivalent) with
   `mapAnthropicError()` classifying 429/5xx as retryable.
2. **Split `decide_issue` from `execute_action`** once actions move money —
   their retry semantics diverge sharply (re-decide is safe; re-refund is not).
3. **Webhook intake + a durable cursor** for a real upstream API — the full
   re-scan works only because the demo feed is tiny and idempotent.
4. **A circuit breaker** so a provider outage does not burn every issue's retry
   budget in parallel.
5. **Per-worker test databases** so Vitest can run files in parallel again
   without trading isolation for serial throughput.
