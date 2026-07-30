# 05 — Agent architecture in detail

Expands the summary in the [README](../../README.md#agent-architecture).
Design spec: `docs/superpowers/specs/2026-07-30-ai-agent-decisioning-design.md`.

## The shape

One `query()` call per issue. Capabilities are:

- **Skills** — one procedure per policy domain (decline, missed installment,
  dispute, refund), loaded as instructions rather than code.
- **Typed in-process tools** — `get_customer`, `get_transaction`, resolved
  against local records in `ai/data/records.ts`. No network, no SQL from the
  model.
- **`Read`**, confined by a `PreToolUse` hook to `policies.md` and the skills
  directory.

After `query()` returns, everything is deterministic:

```
decide()
  ├─ run()      agent → schema-validated verdict
  ├─ verify()   re-check every citedFact against source records
  ├─ score()    base − penalties, clamped by caps
  └─ route()    band → status + applied verb
```

`decide.ts` is the only non-deterministic step in the entire service. Nothing in
`queue/` imports from `ai/` — provider faults are translated into the queue's
retryable/terminal vocabulary at a single point inside `ai/agent/`.

## How confidence is derived

### Where the agent's own number comes from

Honestly: there is no formula. The prompt asks for "your own honest assessment,
0 to 1 — do not inflate it", and adds that a low number on a genuinely ambiguous
case is the right answer and costs nothing. The model returns one number for the
decision as a whole, alongside its trace and citations.

That is deliberate, and it is the reason the rest of this section exists. A
self-reported confidence from a language model is an *opinion*, not a
measurement — it is not a calibrated probability, and nothing stops a model from
sounding certain about a case it has misread. So the design never trusts the
number upward. It is treated as a ceiling on how confident the system is allowed
to be, which deterministic code then pulls down using evidence the model does
not control.

What makes that possible is that the agent has to show its work in a
machine-readable shape. Every rule it considered becomes a trace entry marked
`fired`, `not_met`, or `cant_evaluate`, citing the `policies.md` line it came
from; every fact it relied on becomes a `{source, path, value}` triple that can
be checked against the source records. The number is a claim, but the trace and
citations are checkable — so code scores the *reasoning*, not the self-report.

Measuring how good the self-report actually is means shadow mode, which is why
`confidence_base` is stored next to the final `confidence` in the decision row.

### What code does with it

Code can only lower the agent's number, never raise it. Three steps:

1. **Start** with the agent's own confidence.
2. **Subtract penalties** — 0.15 for every fact it could not check, plus 0.10
   if it flagged missing data.
3. **Apply a ceiling** — some situations cap confidence however sure the agent
   sounds. If several apply, the lowest wins.

```
final = clamp(base − penalties, 0, lowest applicable ceiling)
```

| Ceiling applies when… | Cap | Policy |
| --- | --- | --- |
| Reason is fraud / unauthorized | 0.69 | `policies.md:63` |
| Issue type is not covered by policy | 0.69 | `:86` |
| Dispute amount is over $200 | 0.89 | `:53` |
| Customer lifetime spend is over $2000 | 0.89 | `:88` |

Ceilings are not blended into an average, because averaging would let a
0.99-confident model wash out a fraud cap. Any one factor can veto a high
score; none can rescue a low one.

The final score picks the lane:

| Score | Band | What happens |
| --- | --- | --- |
| ≥ 0.90 | `auto_execute` | verdict applied automatically |
| 0.70 – 0.89 | `execute_flagged` | verdict applied, band recorded for review |
| < 0.70 | `human_decision` | parked in `needs_review`, recommendation kept for the reviewer |

Confidence decides *who acts*; the recommendation decides *what happens*. Below
the floor the two diverge on purpose — the agent may still recommend
`auto_resolve`, but the issue parks with that recommendation attached, so the
reviewer inherits completed reasoning and supplies only the authority.

**The 0.15 and 0.10 magnitudes are judgment calls**, not measurements. They are
named constants in `confidence/score.ts` with a test each, so recalibrating is a
data edit. Real calibration would come from shadow mode measuring agent-vs-human
agreement — this cycle does not build that.

## Prompt injection

Issue text is attacker-controlled: `metadata.reason` on a dispute is whatever
the customer typed. Six layers bound what it can do.

1. Delimited `<issue_data>` framing, plus angle-bracket stripping and length
   caps on the interpolated values.
2. System prompt trust boundary — the policy file and system prompt are the only
   sources of instructions.
3. Schema-constrained output: `recommendation` is a three-value enum. There is
   no free-text action channel to smuggle a command through.
4. `citedFacts` re-checked against source records in `verify.ts`. A fabricated
   or injected fact fails the check.
5. Caps computed from source rows, never from model text. "Ignore the $200
   threshold" cannot move a cap, because the cap never reads the model's words.
6. `Read` confined by a `PreToolUse` hook to `policies.md` and skills — `.env`
   and the fixture JSON are denied.

Two properties follow. Injection is **detectable**: it surfaces as a
verification failure or a denied read, both of which land in the trace rather
than passing silently. And the blast radius is bounded, because "execute" here
means a status transition on the issue itself — not money movement against a
payment provider. That second property is doing a lot of work, and it stops
doing it the day an action actually moves money; see
[06](06-what-id-do-differently.md).

## The five issues

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

One of five auto-executes. That ratio is not a tuning failure — four of these
cases turn on a genuine gap in `policies.md` (a self-contradicting retry budget,
an unevaluable conjunction, a missing sibling-plan field). The system's job
there is to hand a human completed reasoning and a named gap, not to guess. The
gaps it surfaces are the most useful output of the exercise.

Re-record after prompt / skill / policy edits:

```bash
pnpm --filter api record:decisions
```

## Why the data files live inside `apps/api`

`policies.md`, `customers.json`, and `transactions.json` live under
`apps/api/src/modules/issues/ai/data/` (and the payments feed under
`ingestion/sources/data/`). The agent reads them at runtime, so a repo-root
path breaks under `tsc` output or an `apps/api`-only deploy.

Line numbers in `policies.md` are the citation anchor — every trace node names
one. One runtime copy is therefore a correctness requirement, not tidiness. A
second copy that drifts by one line silently invalidates every citation in the
audit trail.
