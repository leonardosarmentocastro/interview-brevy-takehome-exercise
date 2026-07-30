# Design — AI agent decisioning (the harness)

- **Date:** 2026-07-30
- **Status:** Approved for planning
- **Area:** `apps/api` — backend only
- **Builds on:** `2026-07-27-ai-decisioning-layer-design.md` (posture) and
  `2026-07-29-background-processing-queue-design.md` (the queue this plugs into)
- **Replaces:** the `decide()` stub at `src/modules/issues/ai/decide.ts`

## 1. Goal

The queue already ingests issues, schedules jobs, retries with backoff, survives
restarts, and parks work in a human lane. Every issue currently ends in
`needs_review` because `decide()` is an honest stub.

This cycle gives `decide()` intelligence: an Anthropic Agent SDK agent reads the
issue against `policies.md`, gathers the customer and transaction context it
needs, and returns a recommendation with a cited reasoning trace and a
confidence score. Deterministic code then verifies, scores, routes, and records
the outcome.

Nothing in `queue/` changes. `retry-policy.ts` still never learns what Anthropic
is.

## 2. Decisions taken (and what they rule out)

| Decision | Rationale |
|---|---|
| **"Execute" = apply the verdict to the issue's own lifecycle.** No action registry, no simulated refund API. | There is no downstream payment provider. Writing a fake one invents a domain the brief never asked for. The audit trail *is* the deliverable, and it keeps the blast radius of any failure bounded to a status transition. |
| **Confidence: model proposes a base, deterministic code can only lower it.** | A weighted blend lets a confident model dilute a hard safety rule. `min()` composition gives the property we want: any factor can veto, none can rescue. |
| **One agent. Capabilities decomposed as tools and skills, not as subagents.** | `policies.md` is ~90 lines; everything fits one context. Subagents would cost 3–4 round trips per issue, hand results back summarized (lossy — the trace must survive verbatim for citation checking), and be materially harder to test. |
| **`policies.md` moves into the package.** | It is read at runtime. Line numbers are the citation anchor, so exactly one runtime copy is a correctness requirement. |
| **Backend only.** `apps/web` is untouched. | The interview weight is on the backend. |

## 3. Architecture

```
process_issue (unchanged)
  └─ decide(issue, { signal })
       ├─ runAgent()                    Agent SDK query()
       │    ├─ Skill: <domain>          procedure for this issue type
       │    ├─ Read policies.md         authoritative rule text
       │    └─ mcp__payments__*         get_customer, get_transaction
       │    → AgentDecision (json_schema validated)
       ├─ verify()                      re-check cited facts vs source
       ├─ score()                       base − penalties, clamped by caps
       └─ route()                       band → status + decision
  └─ repository.applyAgentDecision()    one transaction
```

The agent produces a *claim*. Everything after `runAgent()` is deterministic and
unit-testable without a network call.

### Module layout

```
apps/api/src/modules/issues/
  ai/
    decide.ts                  the seam; orchestrates the four steps below
    agent/
      run.ts                   query() wrapper: options, abort, result extraction
      tools.ts                 createSdkMcpServer → get_customer, get_transaction
      prompt.ts                system prompt + trust boundary + payload framing
      output-schema.ts         zod schema → outputFormat json_schema
      errors.ts                SDK/API errors → RetryableError | TerminalError
      __tests__/
    confidence/
      verify.ts                cited facts vs source records
      caps.ts                  named cap constants (the safety rules)
      score.ts                 arithmetic + clamping + breakdown
      __tests__/
    routing.ts                 band → target status + decision verb
    data/
      policies.md              moved from repo root
      customers.json           moved from docs/initial/
      transactions.json        moved from docs/initial/
    __tests__/
apps/api/.claude/skills/
  declines/SKILL.md
  installments/SKILL.md
  disputes/SKILL.md
  refunds/SKILL.md
```

### Skills hold procedure, not policy text

If a skill copied the rules there would be two sources of truth and the
"edit the document, change the behaviour" property would die. A skill says
*which* section governs, *what facts* are needed and where to get them, and
*what to do when data is missing*. The agent still `Read`s `policies.md` for the
authoritative text it must cite.

Example — `refunds/SKILL.md`:

> Governing section: `policies.md:70-81`. Read it before deciding.
> You need two facts: days since purchase, and whether the item has shipped.
> Get shipping status from `get_transaction` — never from the issue payload.
> If the transaction carries an installment plan, `:79` changes what the refund
> covers. If shipping data is absent, declare a `dataGap` rather than assuming.

Skills are matched by description, so only the governing domain enters context.

### Data access as in-process tools

`createSdkMcpServer` is the Agent SDK's mechanism for exposing your own
functions. It is **in-process** — no server, no network, no config file. Roughly
twenty lines for both tools.

Chosen over letting the agent `Read` the fixture files because it gives:
narrow access (one record by id, not the whole file — less untrusted text in
context), an audit trail (every data access is a logged tool call), and a seam
where a real customer service later replaces a fixture read without the agent
contract changing.

## 4. The agent's output contract

`outputFormat: { type: 'json_schema', schema }` — the SDK validates the final
message against it.

```ts
{
  recommendation: 'auto_resolve' | 'human_review' | 'escalate',
  confidence: number,              // 0..1, the model's own assessment
  reasoning: string,               // human-readable verdict
  trace: Array<{                   // ≥1 entry, each citing a real line
    src: number,                   // policies.md line number
    rule: string,                  // the rule as the agent read it
    status: 'fired' | 'not_met' | 'cant_evaluate',
    evidence: string,
  }>,
  citedFacts: Array<{              // the machine-checkable restatement
    source: 'issue' | 'customer' | 'transaction',
    path: string,                  // e.g. "shipping.status"
    value: string,
  }>,
  dataGap: string | null,
}
```

`trace[].evidence` is prose for humans. `citedFacts` is the same evidence in a
form `verify.ts` can check against source records — the agent must restate its
reasoning in a falsifiable shape before anything executes.

**There is deliberately no free-text field that becomes behaviour.**
`recommendation` is a three-value enum. This is the chokepoint that bounds what
any injected instruction can achieve.

## 5. Confidence

### Composition

```
final = clamp( base − Σ penalties , 0 , min(caps) )
```

The model owns `base`. Deterministic code owns the ceiling. Code can only
subtract. Layers are **ordered, not weighted** — a weighted average would let a
0.99-confident model average a fraud claim past its hard cap.

Confidence is not "probability the recommendation is correct" — that is not
calibratable from one sample. It answers: **how much of this verdict rests on
things we could independently check?**

### Caps (hard ceilings, each traceable to a policy line)

| Trigger | Cap | Source |
|---|---|---|
| Fraud / unauthorized transaction | `0.69` | `:63` "Auto-resolve: Never" |
| Issue type not covered by `policies.md` | `0.69` | `:86` "when in doubt, escalate" |
| Dispute amount > $200 | `0.89` | `:53` |
| Customer lifetime spend > $2000 | `0.89` | `:54`, `:88` |

Caps are computed from **source rows**, never from model output — which is why
injected text cannot raise a score.

### Penalties (subtractive)

| Condition | Penalty |
|---|---|
| Each `cant_evaluate` trace node | `−0.15` |
| A declared `dataGap` | `−0.10` |

Bands are 20 points wide, so `−0.15` is meaningful but not automatically
band-dropping; **two** unevaluable rules always drop a band. That is intended:
one gap is tolerable, compounding gaps are not.

**These magnitudes are judgment calls, not empirical.** The defensible part is
that they are named constants in one file with a test per rule, so calibration
is a data edit. Real calibration would come from shadow mode (agent-vs-human
agreement over time) — out of scope here, named in the README.

### Rejected outright (not penalized)

A response with no valid `policies.md` citation is malformed, not weak. No
citation → no execution → park for a human.

### Stored breakdown

Every decision persists its own arithmetic so a reviewer can check it:

```
base (model self-report)        0.88
− trace node :37 cant_evaluate  0.15
= adjusted                      0.73
caps applied                    none
→ 73%   band: execute + async review
```

## 6. Routing

| Band | Confidence | `routing_band` | Behaviour |
|---|---|---|---|
| A | `≥ 0.90` | `auto_execute` | Execute the recommendation |
| B | `0.70 – 0.89` | `execute_flagged` | Execute, and flag for asynchronous human review |
| C | `< 0.70` | `human_decision` | No action. Park with the recommendation attached, awaiting `POST /issues/:id/review` |

Recommendation → status, for bands A and B:

| Recommendation | Target status | Decision verb |
|---|---|---|
| `auto_resolve` | `resolved` | `resolve` |
| `escalate` | `escalated` | `escalate` |
| `human_review` | `needs_review` | — (parks; executing "get a human" *is* parking) |

Band C always lands in `needs_review`.

### The verification override

Verification failure is **not** a confidence band. If a cited fact does not
match its source record, confidence is set to `0.0`, the mismatch is recorded,
and the issue transitions to `escalated` — this is `policies.md:86` applied
literally. Documented as the one place the routing table does not apply.

### When recommendation and routing diverge

A cap can leave the agent recommending `auto_resolve` while the issue lands in
`needs_review` — e.g. *"AI recommends resolve (69%, capped by `:63`)"*. This is
intended: the human inherits completed reasoning and supplies only the
authority. `POST /issues/:id/review` already records whether they agreed with,
modified, or rejected it.

## 7. Persistence

Additive only — the existing `model.ts` comment already anticipates this
("the AI cycle adds the `agent` branch — nullable trace columns join later").

**`issue_decisions`** gains nullable, agent-only columns:

| Column | Type | Purpose |
|---|---|---|
| `recommendation` | `text` | the agent's raw verdict, distinct from the applied `decision` verb |
| `confidence` | `numeric(4,3)` | final score |
| `confidence_base` | `numeric(4,3)` | model self-report, before adjustment |
| `routing_band` | `text` | `auto_execute` \| `execute_flagged` \| `human_decision` |
| `score_breakdown` | `jsonb` | the penalties and caps applied, for audit |
| `trace` | `jsonb` | the cited rule-by-rule trace |

`actor` is already an enum containing `agent`; `justification` carries
`reasoning`; `decided_by` becomes the model id.

Band-B issues awaiting async review are found by joining the latest agent
decision on `routing_band = 'execute_flagged'` — derived rather than
denormalized. At 10,000 issues/day this becomes a denormalized flag or partial
index; noted in the README rather than built now.

Existing endpoints need no new shapes: `GET /issues/:id` already assembles an
audit trail from `issueStatusHistory` + `issueDecisions`, and agent decisions
join it for free.

## 8. Failure handling

Every path below already exists in the queue. This cycle only feeds it correctly.

| Failure | Classification | Result |
|---|---|---|
| 429, 5xx, timeout, connection error | `RetryableError` | Existing exponential backoff, 8 attempts ≈ 1h18m — covers "the AI API is down for an hour" |
| 400, 401, 403 | `TerminalError` | Fails on the first attempt |
| Output fails schema validation | Terminal for this attempt | Park in `needs_review` |
| No valid `policies.md` citation | — | Park in `needs_review` |
| `maxTurns` exhausted without a final verdict | — | Park in `needs_review` |
| Cited fact fails verification | — | `escalated`, confidence `0.0` |
| Worker shutdown mid-run | abort | `abortController.abort()`; existing abort path releases the lease and a restarted worker resumes |

`helpers.abortSignal` is wired straight into the SDK's `abortController`, so
shutdown cancels an in-flight model call rather than orphaning it.

Cost and runaway control: `maxTurns: 12` and `maxBudgetUsd` per issue.

**`DECIDE_MODE` fault injection is preserved.** The existing queue tests drive
retry and abort behaviour through it. `decide()` honours `fail_retryable`,
`fail_terminal`, and `slow` before falling through to the agent, so those tests
keep passing untouched.

## 9. Prompt injection

A dispute `reason` field is attacker-controlled text. Six layers — and the last
four hold even if the first two fail completely.

1. **Trust boundary.** `policies.md` is the only trusted instruction; issue,
   customer and transaction data are delimited untrusted evidence. Weakest
   layer; defence in depth, not defence.
2. **Delimiter hygiene.** Untrusted strings are escaped and length-capped so a
   payload cannot close its own data block.
3. **Schema chokepoint.** The agent has no action channel. The most a perfect
   injection achieves is `recommendation: "auto_resolve"` — a request that must
   still survive everything below.
4. **Caps read source rows.** Injected text has no path to the ceiling.
5. **Citations must resolve.** `verify.ts` re-reads each cited line and checks
   the range and rule text. Injected instructions have no line in `policies.md`.
6. **Read-only, enumerated tools.** `allowedTools` is exactly `Read`, `Skill`,
   and the two payments tools. No `Write`, `Edit`, or `Bash`.

Two properties worth stating in the README:

- **Injection is detectable, not merely blocked.** An agent following injected
  instructions cites evidence that does not match source → verification fails →
  escalate. Attempts surface as verification failures.
- **Bounded blast radius.** Because executing is a status transition, total
  compromise yields an issue marked `resolved` that deserved human eyes —
  logged, attributed to `actor: 'agent'`, and reversible. No money moves.

## 10. Testing

TDD throughout, vertical slices, tests in `__tests__/` beside the code under
test, per `AGENTS.md`.

**The agent runner is injectable.** `decide()` takes a runner dependency
defaulting to the real one, so no test reaches the network.

| Unit | Cases |
|---|---|
| `caps.ts` | one test per cap rule, including the near-miss ($200.00 vs $200.01, $2000 boundary) |
| `score.ts` | penalty arithmetic, clamping, cap-beats-base, breakdown shape |
| `verify.ts` | match, mismatch, unknown path, missing record |
| `routing.ts` | band boundaries at 0.90 / 0.899 / 0.70 / 0.699; each recommendation → status |
| `errors.ts` | 429/5xx/timeout → `RetryableError`; 400/401 → `TerminalError`; unknown → terminal (default-deny) |
| `decide.ts` | stubbed runner: happy path, malformed output, uncited trace, verification failure |
| `process-issue.ts` | existing tests unchanged; new test that a ≥0.90 `auto_resolve` lands `resolved` with an `agent` decision row |
| HTTP | `GET /issues/:id` exposes the agent decision, confidence and trace in the audit trail |

**Recorded responses.** One real agent response per seed issue is captured as a
fixture so tests are deterministic and offline, with a script to regenerate them
when the prompt or policy changes. The fixtures double as the Part 2 deliverable
("output showing how each of the 5 issues was processed").

**Interesting edge case** (the brief asks for one): `iss_001`, where
`policies.md:13` ("3 attempts total") and `:16` ("third retry fails")
contradict each other. No structural metric detects this; the model reading the
prose does, and it is the reason the self-report layer exists at all.

## 11. Expected behaviour on the seed set

Verified against the fixtures, not assumed:

| Issue | Shape | Expected band |
|---|---|---|
| `iss_004` refund, 3 days, `not_shipped`, $149, spend $1,847.50 | no cap fires; both cited facts verifiable | A — auto-execute |
| `iss_003` dispute, $249 | `:53` cap at `0.89` | B at best — never A |
| `iss_005` expired card, recurring, spend $4,205 | `:88` high-value cap at `0.89` | B at best — never A |
| `iss_001` insufficient funds, 2 retries | contradictory clauses → low self-report | C |
| `iss_002` missed installment, 5 days overdue | `:37` vs `:38` partial fit | B |

Coverage across all three bands, rather than everything piling into the human
lane.

## 12. Out of scope

- `apps/web` — untouched this cycle. **Follow-up:** `POLICY_TEXT` in
  `apps/web/src/shared/policies/data/fixtures/policies.ts` is a hand-copied
  duplicate of `policies.md` that can drift and silently break the line-number
  citations the UI renders. Generating it from the source file is a build-step
  change, tracked separately.
- Action execution beyond status transitions.
- Shadow mode and agent-vs-human agreement measurement (named in the README as
  the path to real confidence calibration).
- Policy versioning — decisions cite line numbers against the current file.

## 13. Open implementation detail

Skill loading via `settingSources: ['project']` with `cwd` pinned to the api
package root needs confirming against the installed SDK version in the first
slice. If skills do not load as expected, the fallback is a `policy_section`
tool serving the same procedural text — the design is unaffected either way.

## 14. Model

`claude-opus-5`. Sonnet 5 is the cost lever if per-issue spend matters more than
verdict quality; the choice is one constant in `run.ts`.
