# 04 — Queue design in detail

Expands the summary in the [README](../../README.md#queue-design).

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

## Mutual exclusion belongs to the job lease

The tempting claim is `UPDATE issues SET status='processing' WHERE status='pending'`
— whoever wins the row wins the work. It is wrong under crash. If a worker
flips an issue to `processing` and dies, the status-based claim sees "already
claimed" forever and the issue is stranded with no process alive to finish it.
Recovering means a sweeper that guesses at what counts as a stale `processing`
row, which is a lease reimplemented badly.

Graphile Worker already has a lease with an expiry. The issue's `status` is
therefore business state — what an operator sees — and never a lock. Crash
recovery is then not a feature we wrote: the lock expires, the job returns to
the pool, and a worker picks it up.

## The entry guard closes a different window

`hasLeftTheQueue` is not about two workers racing. It covers the ordering
outcome-commits-then-process-dies: the decision is durably written, but the job
was never marked complete, so the queue retries against finished work. Without
the guard the issue would be decided a second time — a second row in
`issue_decisions`, possibly a different verdict, and a status transition out of
a terminal state.

So the invariant is: the lease makes work run *at least* once, and the entry
guard makes the outcome happen *at most* once. Exactly-once is the pair, not
either alone.

## When the AI provider is down for an hour

Eight attempts under Graphile Worker's fixed `exp(least(10, attempt))` backoff
span ~1h18m. A ninth would push the total to ~3h33m, which is too long to leave
a payment issue unattended; the library default of 25 spans days. So the budget
is a deliberate 8, set in `MAX_ATTEMPTS.processIssue`.

What happens at exhaustion matters more than the number. The handler **does not
throw** on the final attempt — it parks the issue in `needs_review` with the
failure reason written to `issue_status_history`. Graphile has no "fail
permanently" signal, and a permanently-failed job row is invisible to
operators: nobody is watching `graphile_worker.jobs`, everybody is watching the
review queue. The dead letter has to be a human lane or it is not a dead letter.

Retryability is default-deny (`isRetryable` returns true only for
`RetryableError`). A malformed request or bad credentials fails on attempt one
instead of burning eight provider calls over an hour to learn something the
first response already said.

## Why Postgres and not Redis/BullMQ

Enqueue is a SQL `add_job` call on the *caller's* transaction. The issue INSERT
and the job INSERT commit together or not at all.

With Redis the two writes go to different systems, and a crash in between
strands an issue with no job — the classic dual-write. Fixing it means an
outbox table plus a relay, or a periodic sweeper looking for issues with no
job, which is more moving parts than the queue itself. Postgres makes that
failure mode impossible by construction rather than by diligence.

The cost is throughput: a Postgres-backed queue tops out far below Redis. At
five issues, or ten thousand a day, that ceiling is nowhere in sight, and the
day it is, the queue substrate is a swap behind `queue/enqueue.ts` — by which
point the outbox is worth its complexity.
