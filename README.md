# Payment Issue Processing Service

A backend service that takes payment exceptions from an upstream BNPL /
payments platform (declines, expired cards, missed installments, disputes,
refunds), stores them in Postgres, and runs each one through a durable job queue
into an AI decision pipeline. Every status change is audited. A human review
endpoint resolves what the pipeline cannot.

A Next.js UI exists under `apps/web`; this README is about the API and worker.

```bash
pnpm install
pnpm --filter api db:up && pnpm --filter api db:migrate
pnpm --filter api worker          # terminal 1 — crontab + process_issue
pnpm --filter api dev             # terminal 2 — HTTP API on :3333
```

## Documentation

This README is the big picture: how the system fits together, the three
decisions that shaped it, and what I would change next. Each section links to a
companion doc that goes a level deeper.

| | |
| --- | --- |
| [01 — Architecture](docs/readme/01-architecture.md) | Diagrams, one issue traced end to end, module map |
| [02 — Running it](docs/readme/02-running-it.md) | Setup, six runnable scenarios, tests |
| [03 — Database schema](docs/readme/03-database-schema.md) | Tables column by column, scaling to 10k/day |
| [04 — Queue design](docs/readme/04-queue-design.md) | Failure-mode table, leases, retry budget |
| [05 — Agent architecture](docs/readme/05-agent-architecture.md) | Confidence, prompt injection, the five issues |
| [06 — What I'd do differently](docs/readme/06-what-id-do-differently.md) | Full backlog with reasoning |

Design specs and implementation plans for each build cycle live under
`docs/superpowers/`. The original kickoff material is preserved in
`archived/initial/`.

## Architecture overview

Two processes, one database. They never talk to each other — Postgres is the
only channel between them.

```
                          ┌──────────── Postgres ────────────┐
  ┌─────────────┐         │  issues                          │
  │  api        │────────▶│  issue_status_history            │
  │  (express)  │         │  issue_decisions                 │
  │  :3333      │         │      business state (permanent)  │
  └─────────────┘         │                                  │
                          │  graphile_worker.*               │
  ┌─────────────┐         │      job state (archived)        │
  │  worker     │◀───────▶│                                  │
  └─────────────┘ LISTEN  └──────────────────────────────────┘
     ├── crontab:  * * * * * ingest_issues
     ├── task:     ingest_issues
     └── task:     process_issue
```

**How data flows.** Issues enter through one function, `ingestIssue`, whichever
door they arrive at — the cron tick, `POST /issues`, or `pnpm seed`. It opens a
single transaction and does three things: insert the issue as `pending` if its
source ID is new, record the intake in the status history, and enqueue a
`process_issue` job. All three commit together or none do.

The worker wakes on `LISTEN/NOTIFY`, claims the job, and runs `process_issue`:
check whether this issue was already finished, flip `pending → processing`, call
`decide()`. `decide()` asks the agent for a verdict, then deterministically
verifies, scores and routes it. Confident verdicts are applied — `resolved` or
`escalated`. Everything else parks in `needs_review` with the agent's reasoning
attached, for a human to finish via `POST /issues/:id/review`.

**Where state lives.** Two kinds, deliberately separated:

| Kind | Tables | Lifetime |
| --- | --- | --- |
| Business state | `issues`, `issue_status_history`, `issue_decisions` | Permanent audit trail |
| Operational state | `graphile_worker.*` | Ephemeral — archived once the job is done |

Postgres is the system of record. The queue holds only job references
(`{ issueId }`), never issue payloads. That is the load-bearing choice: if the
issue lived in the queue, "does it survive a restart?" would be a
queue-durability question. Here the database has already answered it.

**How the pieces connect.** Dependencies point one way. The queue layer knows
nothing about AI, the AI layer knows nothing about HTTP, and the two worker
tasks are the only place they meet. So the model provider and the queue
substrate are each swappable without touching the other.

Diagrams, the step-by-step trace of one issue, and the module map:
**[docs/01](docs/readme/01-architecture.md)**.

## Trade-offs and decisions

### Database schema

**One table for issues, with the type-specific tail in JSONB.** Every payment
issue shares a head — source ID, type, status, amount, timestamps — and differs
only in the tail: a decline carries an error code, a missed installment carries
days overdue. A table per type would make each tail properly constrained, at the
cost of a join on every list query and a migration for every new issue type. I
chose the opposite: uniform intake, single-table queries, and a new issue type
is a new enum value. The price is that tail fields get no database guarantees.
That is the right trade while the tails are read by an agent rather than
filtered on — and a field that earns a query can be promoted to a real column.

**The audit trail is append-only, in two tables.** One records every status
transition, the other records every decision and its justification. They are
separate because transitions happen without decisions — intake, or a worker
picking work up. Nothing is ever updated in place, so "why is this issue
resolved?" is a query rather than a reconstruction. Agent decisions also store
the model's original confidence next to the final adjusted one, because you
cannot calibrate an agent later if you only kept the number after the code
adjusted it.

**At 10,000 issues/day** — about 7 writes a minute — a single Postgres primary
is still comfortable, so the changes are about keeping reads cheap rather than
surviving load: an index for the operator board's queue query, archiving the
history table as it outgrows the working set, and a read replica so review
traffic stops competing with intake. The one I would do first is cursor
pagination on `GET /issues`, which returns the full set today. It is the only
item on that list that changes the API contract, so it should land before
clients depend on the current shape.

Column-by-column detail: **[docs/03](docs/readme/03-database-schema.md)**.

### Queue design

**The queue owns who is working on an issue; the database owns what is true
about it.** Keeping those separate is what makes crashes uneventful. The
tempting shortcut is to claim work by flipping the issue's own status to
`processing` — but then a worker that dies mid-flight leaves an issue that looks
claimed forever, with no process alive to finish it. Instead the job carries a
lease with an expiry. Kill the worker mid-processing and the lease expires, the
job returns to the pool, and a restarted worker picks the same issue back up.
The issue's status stays a business fact, never a lock.

That guarantees the work runs *at least* once. The matching guarantee is an
entry check at the top of the task: if this issue has already been decided, stop
immediately. It covers the case where the outcome was committed but the process
died before the job was marked done, so the queue retries against finished work.
The lease makes work run at least once; the entry check makes the outcome happen
at most once. Exactly-once is the pair, not either alone.

**If the AI API is down for an hour**, the job retries 8 times with growing
gaps, spanning about 1h18m — long enough to ride out a real outage, short enough
that a payment issue is not left unattended. What happens *after* that matters
more than the number: the task stops failing and instead parks the issue in
`needs_review` with the reason recorded. A permanently-failed job row would be
invisible, because operators watch the review queue and not the jobs table. The
dead letter has to be a human lane or it is not a dead letter.

**Postgres over Redis** for the queue itself, for one reason: enqueuing is a SQL
call, so it joins the same transaction as the issue insert. With an external
queue those are two writes to two systems, and a crash in between strands an
issue that nobody will ever process — a problem you then solve with an outbox
table or a sweeper. Postgres makes that failure impossible by construction
instead. The cost is throughput, and that ceiling is far away at this volume.

Failure-mode table and the reasoning behind each: **[docs/04](docs/readme/04-queue-design.md)**.

### Agent architecture

**One agent, specialised by instructions rather than by more agents.** The
colleague suggesting a single agent is proposing what is already here, so the
real question is why I did not decompose. The entire policy document is ~90
lines and fits comfortably in one context. Splitting it into a subagent per
policy domain would add round trips per issue and, more importantly, force
results through a summarisation step — and summarising is lossy in exactly the
wrong place, because the citation trail is the product. So specialisation lives
in *skills* (one procedure per policy domain) and typed tools for fetching
customer and transaction records. Same division of labour, no orchestration tax.

**The model proposes; code disposes.** The agent call is the only
non-deterministic step in the service, and it is fenced on both sides. It
returns a structured verdict with a confidence score and a citation for every
rule it applied. Deterministic code then re-checks each cited fact against the
source records, lowers confidence for anything the agent could not verify, and
applies hard ceilings drawn from the records themselves — a fraud reason or a
large dispute caps confidence no matter how certain the model sounds. Code can
only subtract, never add. The final score picks the lane: high confidence
executes, middling confidence executes but is flagged, low confidence parks for
a human with the agent's reasoning attached.

**Untrusted text is contained by design, not by detection.** A dispute's reason
field is whatever a customer typed, so it is treated as data throughout:
delimited and sanitised on the way in, and constrained on the way out to a
three-value verdict enum with no free-text action channel. Cited facts are
re-checked against source records and confidence ceilings are computed from
those records, so no instruction hidden in issue text can raise a score or
invent a fact. Two things follow: an injection attempt surfaces as a
verification failure rather than passing silently, and the blast radius is small
because "execute" means changing a status on our own record — not moving money.
That last point is doing real work, and it stops being true the day an action
issues a refund, which is why splitting decide from execute is next on the list.

Confidence maths, the containment layers in full, and all five recorded
decisions with commentary: **[docs/05](docs/readme/05-agent-architecture.md)**.

## What I'd do differently

Ranked by what unblocks the most:

1. **Shadow-mode calibration** — every confidence penalty and ceiling is a
   judgment call, tested but not measured. Run the agent alongside human
   deciders and fit the numbers to the agreement data. First because everything
   downstream — where the auto-execute threshold belongs, whether the flagged
   middle band should exist at all — is guesswork without it.
2. **Split deciding from executing** — safe to combine only while "execute"
   means a status change. Once an action issues a refund the two halves have
   opposite retry semantics: re-deciding is free, re-refunding is a duplicate
   payout.
3. **Webhook intake with a durable cursor** — the cron re-reads the whole feed
   every minute and relies on source-ID uniqueness to make that harmless. Fine
   for five bundled rows; a full scan per minute against a real upstream.
4. **A circuit breaker around the provider** — an outage today burns every
   in-flight issue's retry budget in parallel, each one independently
   rediscovering that the provider is down.
5. **Cursor pagination on `GET /issues`** — routine work, but it changes the API
   contract, so it should happen before external clients exist.
6. **Per-worker test databases** — API tests run serially because they share one
   database. Isolation is right; serial throughput is the price.

Reasoning for each, plus a known drift risk in the web app's copied policy
fixture: **[docs/06](docs/readme/06-what-id-do-differently.md)**.
