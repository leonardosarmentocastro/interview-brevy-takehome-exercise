# 06 — What I'd do differently

The [README](../../README.md#what-id-do-differently) carries the ranked shortlist.
This is the full backlog with the reasoning.

## 1. Shadow-mode calibration

Every penalty and cap magnitude in `confidence/score.ts` is a judgment call.
They are defensible and tested, but no number in there was measured. Shadow mode
— run the agent on issues a human is also deciding, record both, compare —
turns the constants into a fitted parameter instead of an opinion. It is first
on the list because everything downstream (where the auto-execute floor sits,
whether `execute_flagged` deserves to exist) is unanswerable without it, and
because the schema already stores `confidence_base` alongside `confidence`
specifically so the comparison is possible retroactively.

## 2. Split `decide_issue` from `execute_action`

Today one job decides and applies. That is safe only because "apply" means a
status transition on a row we own. The moment an action issues a refund against
a payment provider, the two halves have opposite retry semantics: re-deciding is
free, re-refunding is a duplicate payout. They need separate jobs with separate
budgets, and the execute half needs an idempotency key carried to the provider.
The seam is easy now and expensive after the first double refund.

## 3. Webhook intake plus a durable cursor

The cron re-reads the entire feed every minute and relies on `external_id`
uniqueness to make that free. That works because the feed is five rows in a
bundled file. Against a real upstream API it is a full table scan per minute.
Webhook intake with a durable cursor, and the full re-scan demoted to a
reconciliation sweep on a slow schedule, is the shape that survives contact with
a real source.

## 4. A circuit breaker around the provider

A provider outage today burns every in-flight issue's retry budget in parallel:
N issues × 8 attempts, all failing for the same reason, all discovering it
independently. A breaker that opens on repeated failures and pauses the queue
would let one issue learn the provider is down on behalf of all of them, and
would let the budget mean "this issue is stuck" rather than "the world is
stuck".

## 5. Cursor pagination on `GET /issues`

The list endpoint returns the full result set. Honest at five rows,
indefensible at 10,000/day. It is ranked below the items above because it is
well-understood work, but it is the one thing here that is a *contract* change,
so it wants to land before external clients depend on the current shape. See
[03](03-database-schema.md#at-10000-issuesday) for the indexing that goes with
it.

## 6. Per-worker test databases

Vitest runs API test files serially because they share one test database.
Isolation is correct, throughput is the price. Per-worker databases (one
template, N clones keyed by `VITEST_WORKER_ID`) buy parallelism back without
trading isolation for it. Ranked last because it costs contributors time rather
than production correctness — but it is the item most likely to actually get
done, because the pain is felt on every run.
