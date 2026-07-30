# 02 — Running it

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

The worker needs `ANTHROPIC_API_KEY` to run the agent. Without it, issues still
flow through the pipeline and park in `needs_review`.

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

## Offline agent replay

Replays recorded agent responses through verify / score / route, with no API
calls and no database:

```bash
pnpm --filter api demo
```

Output and commentary: [05 — Agent architecture](05-agent-architecture.md#the-five-issues).

Re-record after prompt / skill / policy edits (this one does call the API):

```bash
pnpm --filter api record:decisions
```

## Tests

```bash
pnpm --filter api test
```

Vitest runs API test files serially against a dedicated test database. See
[06 — What I'd do differently](06-what-id-do-differently.md) for why that is
not parallel yet.
