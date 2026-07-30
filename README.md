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
                      3. decide()          ← agent + verify/score/route
                      4. applyAgentDecision (or park) in one transaction
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
5. **Outcome** — `decide()` runs the agent, then deterministic verify / score /
   route. High-confidence cases resolve or escalate via
   `applyAgentDecision`; anything below the floor (or with no usable verdict)
   parks in `needs_review`. A human can still finish parked work with
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

Within a minute the cron ingests all 5 issues and the worker runs each through
`decide()` — clean high-confidence cases resolve; the rest park in
`needs_review` (requires `ANTHROPIC_API_KEY` on the worker).

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

## AI agent decisioning

Design: `docs/superpowers/specs/2026-07-30-ai-agent-decisioning-design.md`.

### Architecture — why one agent

One `query()` call per issue. Capabilities are skills (procedure, one per
policy domain) and typed in-process tools (`get_customer`, `get_transaction`),
not subagents. `policies.md` is ~90 lines; everything fits one context.
Subagents would cost 3–4 round trips, hand results back summarised (lossy —
the citation trace must survive verbatim), and be harder to test. A colleague
asking "why not a single agent?" is asking the question we already answered by
choosing exactly that.

`decide()` is the only non-deterministic step. After it returns, deterministic
code verifies cited facts against source records, scores confidence, routes
into a band, and persists one transaction. Nothing in `queue/` knows about
Anthropic — `mapAgentError` is the only place that maps provider faults onto
the existing `RetryableError` / `TerminalError` budget.

### How confidence is derived

```
final = clamp(base − penalties, 0, min(caps))
```

The model owns the base; code owns the ceiling and can only subtract. Layers
are **ordered, not weighted** — a weighted blend would let a 0.99-confident
model dilute a fraud cap. Any factor can veto; none can rescue.

| Cap | Ceiling | Policy |
| --- | --- | --- |
| Fraud / unauthorized reason | 0.69 | `policies.md:63` |
| Issue type not covered | 0.69 | `:86` |
| Dispute amount > $200 | 0.89 | `:53` |
| Lifetime spend > $2000 | 0.89 | `:88` |

Penalties: each `cant_evaluate` trace node −0.15; a declared `dataGap` −0.10.
**These magnitudes are judgment calls**, not empirical. They live as named
constants with a test each so calibration is a data edit. Real calibration
would come from shadow mode measuring agent-vs-human agreement — this cycle
does not build that.

Routing bands: `≥0.90` → `auto_execute`; `0.70–0.89` → `execute_flagged`;
`<0.70` → `human_decision` (park; recommendation kept for the reviewer).

### Prompt injection

Six layers bound what untrusted issue text can do:

1. Delimited `<issue_data>` framing + angle-bracket stripping / length caps
2. System prompt trust boundary (policy + system prompt only are instructions)
3. Schema-constrained output (`recommendation` is a three-value enum; no
   free-text action channel)
4. `citedFacts` re-checked against source records (`verify.ts`)
5. Caps computed from source rows, never from model text
6. `Read` confined by a `PreToolUse` hook to `policies.md` and skills — `.env`
   and fixture JSON are denied

Two properties follow: injection is **detectable** (it surfaces as a
verification failure or a denied read), and the blast radius is bounded
because "execute" means a status transition on the issue itself, not money
movement against a payment provider.

### The five issues

Offline replay of recorded agent responses through verify / score / route
(`pnpm --filter api demo`):

```
iss_001  decline
  base (model self-report)      0.72
  − trace node :13 cant_evaluate0.15
  − trace node :16 cant_evaluate0.15
  − trace node :14 cant_evaluate0.15
  − data gap declared           0.10
  → 17%   human_decision → needs_review
  This insufficient-funds decline cannot be auto-resolved under any reading of policies.md:17, so the only live question is whether the retry budget is exhausted — and the policy contradicts itself there. With auto_retry_count=2, policies.md:13 ("up to 3 attempts total") says the budget is spent if the original charge counts as attempt one, while policies.md:16 ("escalate when the third retry fails") says a third retry is still owed. The case turns exactly on that difference, so it goes to a human; the customer is otherwise unremarkable (low risk, 11/12 successful payments, lifetime spend $1,847.50, below the $2,000 high-value bar at policies.md:88).

iss_002  missed_installment
  base (model self-report)      0.78
  − trace node :41 cant_evaluate0.15
  − trace node :37 cant_evaluate0.15
  − data gap declared           0.10
  → 38%   human_decision → needs_review
  Auto-resolve is off the table: the account is 5 days overdue (limit is 3) and the customer's risk score is "medium", not "low" — two of the three required conditions fail outright, and the third (successful retry) can't be evaluated because no payment processor is reachable. Neither escalation trigger clearly fires either: 5 days is inside the 7-day grace period, and while the customer holds 2 concurrent installment plans, the data shows plan count only — not whether the second plan is also delinquent. That leaves a case the policy neither auto-resolves nor escalates, so it goes to a human, who can attempt the retry and check the sibling plan's standing.

iss_003  dispute
  base (model self-report)      0.93
  − trace node :55 cant_evaluate0.15
  − data gap declared           0.10
  cap policies.md:53            0.89  ← dispute amount exceeds $200
  → 68%   human_decision → needs_review
  Escalate. The item-not-received auto-resolve condition fails because tracking shows the package still in_transit at a Chicago distribution center with no delivery confirmation, and the $249 dispute amount independently exceeds the $200 escalation threshold. The customer is not high-value ($312 lifetime spend) and merchant fulfilment history is unavailable, but neither changes the result.

iss_004  refund_request
  base (model self-report)      0.93
  → 93%   auto_execute → resolved
  Changed-mind refund at day 3 of the 14-day window with shipping.status confirmed as "not_shipped", so both halves of the policies.md:77 auto-resolve condition are satisfied and no escalation trigger at :78 applies. Because the transaction carries an installment plan, :79 limits the refund to paid installments only: refund $37.25 (1 of 4 paid) and cancel the remaining 3 — the issue payload's $149 is the full plan value and must not be paid out. Lifetime spend of $1,847.50 is under the :88 high-value threshold, though close enough to it to be worth noting.

iss_005  decline
  base (model self-report)      0.72
  − trace node :25 cant_evaluate0.15
  − data gap declared           0.10
  cap policies.md:88            0.89  ← customer lifetime spend exceeds $2000
  → 47%   human_decision → needs_review
  Expired-card declines can never auto-resolve (policies.md:26) — the customer must supply a new payment method, and retrying is explicitly ruled out (:23). The escalation trigger at :25 requires no response after 48 hours AND a recurring subscription; the recurring half is confirmed (is_recurring true, 14 months active), but there is no notification-sent timestamp, response record, or days_since_purchase in the payload, so the 48-hour half cannot be evaluated and escalating on half a conjunction would be a guess. Routing to a human who can check the notification log and drive the payment-method update, which is time-sensitive since the next box ships 2025-01-20.
```

Re-record after prompt / skill / policy edits:

```bash
pnpm --filter api record:decisions
```

### Data file moves

`policies.md`, `customers.json`, and `transactions.json` live under
`apps/api/src/modules/issues/ai/data/` (and the payments feed under
`ingestion/sources/data/`). The agent reads them at runtime, so a repo-root
path breaks under `tsc` output or an apps/api-only deploy. Line numbers in
`policies.md` are the citation anchor — one runtime copy is a correctness
requirement, not tidiness.

### Known follow-up

`POLICY_TEXT` in `apps/web/src/shared/policies/data/fixtures/policies.ts` is a
hand-copied duplicate of `policies.md` that can drift and silently break the
line-number citations the UI renders. Generating it from the source file is a
build-step change, tracked separately.

## What I'd do differently

1. **Shadow-mode calibration** — measure agent-vs-human agreement on parked
   cases and tighten penalty magnitudes from data rather than judgment.
2. **Split `decide_issue` from `execute_action`** once actions move money —
   their retry semantics diverge sharply (re-decide is safe; re-refund is not).
3. **Webhook intake + a durable cursor** for a real upstream API — the full
   re-scan works only because the demo feed is tiny and idempotent.
4. **A circuit breaker** so a provider outage does not burn every issue's retry
   budget in parallel.
5. **Per-worker test databases** so Vitest can run files in parallel again
   without trading isolation for serial throughput.
