# 01 — Architecture in detail

Expands the overview in the [README](../../README.md#architecture-overview).

## Two processes, one database

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

The two processes never talk to each other. They share Postgres, and the queue
tables are the only channel between them. `LISTEN/NOTIFY` is a latency
optimisation, not a dependency — a worker that misses a notification still picks
the job up on its next poll.

## The full pipeline

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
                      3. decide()          ← agent + verify/score/route
                      4. applyAgentDecision (or park) in one transaction
```

## How one issue travels the system

1. **Cron pulls the feed** — `apps/api/src/modules/issues/tasks/ingest-issues.ts`
   reads the bundled `payment_issues.json` via the file source and calls
   `ingestIssue` once per row.
2. **Insert + enqueue as one unit** — `apps/api/src/modules/issues/ingestion/ingest.ts`
   opens a transaction, inserts the issue if its `external_id` is new, and
   enqueues a `process_issue` job. No insert means no job, so re-reads are free.
3. **Transactional enqueue** — `apps/api/src/queue/enqueue.ts` calls
   `graphile_worker.add_job` on the same connection as the insert, so a crash
   cannot leave an issue without a job.
4. **Worker claims the job** — `apps/api/src/modules/issues/tasks/process-issue.ts`
   loads the issue, returns early if it has already left the queue, flips
   `pending → processing`, and calls `decide()`.
5. **Outcome** — `decide()` runs the agent, then deterministic verify / score /
   route. High-confidence cases resolve or escalate via `applyAgentDecision`;
   anything below the floor (or with no usable verdict) parks in `needs_review`.
   A human finishes parked work with `POST /issues/:id/review`.

## Where state lives

| Kind | Tables | Lifetime |
| --- | --- | --- |
| Business state | `issues`, `issue_status_history`, `issue_decisions` | Permanent audit trail |
| Operational state | `graphile_worker.*` | Ephemeral — jobs are archived/removed once done |

Postgres is the system of record. The queue holds only job references
(`{ issueId }`), never issue payloads. If the issue lived in the queue,
"survive a restart" would be a queue-durability question; with this design it is
already answered by the database.

## Module map

```
apps/api/src/
  server/            express app, routes, middlewares
  worker/            graphile worker entrypoint + crontab
  queue/             enqueue.ts, retry-policy.ts   ← knows nothing about AI
  db/                drizzle client + schema re-export
  modules/issues/
    model.ts         the three tables
    resolvers/       list, get-by-id, review
    ingestion/       ingest.ts + sources/ (file source + feed data)
    tasks/           ingest-issues.ts, process-issue.ts
    ai/
      decide.ts      orchestrates agent → verify → score → route
      routing.ts     bands and applied verbs
      agent/         prompt, tools, output schema, read guard, errors
      confidence/    verify.ts, caps.ts, score.ts
      data/          policies.md, customers.json, transactions.json
```

The dependency direction is one-way: `queue/` never imports from `ai/`. Provider
faults are translated into the queue's retry vocabulary at a single point inside
`ai/agent/`, so the queue never learns which model vendor it is serving.
