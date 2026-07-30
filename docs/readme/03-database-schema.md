# 03 — Database schema in detail

Expands the summary in the [README](../../README.md#database-schema).

## Three tables

```
issues                      one row per payment issue, mutable status
  id                 uuid pk
  external_id        text unique      ← the idempotency seam
  type               enum(decline, missed_installment, dispute, refund_request)
  customer_id        text
  transaction_id     text
  amount             numeric(12,2)    ← normalised: amount ?? amount_due
  merchant           text null        ← absent on missed_installment
  status             enum(pending, processing, needs_review, on_hold,
                          resolved, escalated)
  metadata           jsonb            ← the type-specific tail
  created_at         timestamptz      ← source time
  ingested_at        timestamptz      ← system time

issue_status_history        append-only, one row per transition
  issue_id, from_status (null = intake), to_status, actor, reason,
  decision_id null → issue_decisions, at

issue_decisions             append-only, one row per decision
  issue_id, actor(human|agent), decision(resolve|escalate|hold|defer),
  justification, decided_by,
  -- agent-only, all nullable:
  recommendation, confidence, confidence_base, routing_band,
  score_breakdown jsonb, trace jsonb, at
```

## Why a JSONB tail instead of a table per type

Issues share a head and differ only in the tail. A table per type would make
each tail properly constrained, but every list query would need a join and every
new issue type would need a migration. `metadata jsonb` takes the other side:
one insert path, one table to query, and a fifth issue type is a new enum value.

What you give up is database guarantees on those tail fields — no `NOT NULL` on
`days_overdue`, no foreign keys, no cheap index. That is affordable because the
tails are *read by the agent*, not filtered on. The fields the system actually
reasons about live in the head and are constrained there: `external_id UNIQUE`
is what makes re-ingestion free, and the status enum is what keeps the state
machine closed. A tail field that starts earning queries gets promoted to a
column.

## Why the audit trail is two tables, not a log column

The two tables answer different questions. `issue_status_history` is *what
happened to this issue*; `issue_decisions` is *what was decided and why*. They
are separate because transitions happen without decisions — intake, a worker
picking work up, a permanent-failure park — so folding them together would mean
half-empty rows. Where both exist, the history row's nullable `decision_id`
links them.

Both are append-only, so "why is this issue resolved?" is a query rather than a
reconstruction. One detail is worth calling out: an agent decision stores
`confidence_base`, the model's original number, next to the final `confidence`
that code arrived at. Keeping both is what makes calibration possible later —
you cannot measure how well-judged the agent is if you only kept the number
after the code adjusted it.

## At 10,000 issues/day

That is ~7 writes/minute average, and the hot path stays comfortable on a single
Postgres primary. Three things earn attention before it stops being comfortable:

1. **An index on `issues(status, ingested_at)`.** The operator board's query is
   "oldest `needs_review` first", and that is a sequential scan today. It is
   cheap at 5 rows and the first thing to hurt at 3.6M/year.
2. **Partitioning or archiving `issue_status_history`.** It grows several times
   faster than `issues` and is almost never read outside a single issue's
   timeline. Monthly partitions on `at`, with old partitions detached to cold
   storage, keep the working set flat.
3. **A read replica for list queries**, so review traffic does not contend with
   intake writes. The list endpoints are the only genuinely read-heavy path and
   they tolerate replication lag — an operator board a second stale is fine.

Beyond those, the change I would actually make first is **cursor pagination on
`GET /issues`**. It returns the full set today, which is honest at five rows and
indefensible at ten thousand a day. Everything else on this list is a tuning
exercise; that one is a contract change, so it wants to happen before there are
clients depending on the current shape.
