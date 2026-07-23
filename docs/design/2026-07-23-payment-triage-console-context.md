# Payment Triage Console — System Context & Decisions

> **Status:** living design context, captured 2026-07-23.
> **Purpose:** record the reasoning and decisions that frame the exercise so future
> sessions can *refer to and challenge* them rather than re-deriving from scratch.
> This is **not** the final spec — it is the shared map. The first concrete
> deliverable is the **Operator screen** (see §5 and the separate operator-screen spec).
>
> Source material: `policies.md`, `payment_issues.json`, `transactions.json`,
> `customers.json`, and the exploratory `PROTOTYPE-queue-sketch.html`.

---

## 1. What we are building

A **decisioning/triage console for policy-governed payment exceptions**. It sits
downstream of a busy BNPL / e-commerce platform, receives the payment issues that
platform throws off ("tickets"), and turns the prose rules in `policies.md` into
**consistent, auditable, defensible decisions** — resolving the ones it is
authorized to, and routing the rest to a human with the reasoning already done.

- **Primary user:** a support **operator** (frontline human reviewer).
- **Product value:** throughput *and* consistency of defensible decisions at
  volume — not raw speed. On a busy store there are hundreds of tickets; most do
  not need a human. The system's job is to separate wheat from chaff.
- **Second-order value (the instrument):** because it must decide from a prose
  policy, the console naturally exposes **where the written policy cannot decide**
  (gaps, contradictions, missing data). Every prose fix moves volume into
  automation. This is a byproduct we want to surface, not the primary UI.

---

## 2. Core architecture — three tiers of actor, one promotion ladder

Tickets are handled by one of **three actors**, and are **promoted *up* the ladder**
when the tier below cannot resolve them. Separating by *actor* is what resolves the
"who owns this?" ambiguity that a single shared board could not.

```
  Virtual agent (machine)  ──promote──▶  Operator (human)  ──escalate──▶  Specialist
  auto-resolve, retries,                 shared backlog +                 fraud, large
  timed/system holds                     private working lanes            disputes, etc.
```

- Movement is **one-directional** in the MVP: machine → operator → specialist.
- Each promotion trigger is already written in `policies.md` (see §7). Defining
  those triggers explicitly is arguably the most important surface in the system.

---

## 3. Actor 1 — Virtual agent (machine) · *monitor view* (deferred build)

The automation tier. **Read-only monitor, not a workspace** — no human drags a
card; the clock moves everything.

- **Instant routing:** the policy engine decides on arrival, so there is **no
  "backlog" column** here (nothing waits for the robot to look).
- **Columns:** `Waiting / On-hold (system-managed)` → `Resolved (automatically)`.
- **Volume:** "Resolved (auto)" is the bulk of traffic → shown as a **rolling
  count you can drill into**, never an infinite wall of cards.
- **System-managed waits live here:** the 2-day retry timer (insufficient funds),
  the auto-sent card-update nudge (expired card), the grace-period clock (missed
  installment). These began with **zero human involvement**.
- **Escape hatches (required):** every card on the monitor can be **manually
  promoted to the operator backlog** or **escalated immediately to a specialist**,
  so a human is never stuck watching a card they cannot move.
- **Leak handling (decided):** a system-managed wait that **no rule can ever
  release** (see §8) is **auto-promoted to the shared operator backlog and
  signalized as such** ("no rule could resolve this — needs a human"), per
  `policies.md:86` ("when in doubt, escalate"). We do **not** leave leaks to rot
  on the monitor forever.

---

## 4. Actor 3 — Specialist · *escalation target* (deferred build)

Higher-tier human(s) who own what a standard operator may not decide (fraud /
unauthorized charges, disputes > $200, high-value customers, exhausted retries).

- In the MVP, **escalation is a one-way handoff out of the operator board.** It
  does **not** return to the standard operator.
- The specialist board is its own view, defined later. When operator
  privileges/roles exist, escalation becomes a promotion *into* the specialist's
  board.

---

## 5. Actor 2 — Operator · **THE MVP FIRST SCREEN**

The board a standard operator works. It is **not one global board** — it is
**"the shared backlog + MY private lanes."**

| Column | Owner | Filled / moved by |
|---|---|---|
| **Needs review** | **Shared** — every operator sees it | System promotes tickets in; anyone can pull |
| **In review** | **Mine only** | I pull a ticket here; it leaves everyone else's view |
| **On hold / Waiting** | **Mine only** | I park it while waiting on a return/customer/carrier; a clock returns it to me |
| **Resolved** | **Mine only** (terminal) | I close it |

- **Escalate** and **auto-resolve** are **exits to the other two boards**, not
  columns here.
- **On hold is private and legitimate here** because it holds **post-pull** waits:
  "I grabbed this ticket, I'm waiting on something (e.g. a return), it is still my
  duty, check back in a few days." This is distinct from the machine's system
  waits, which live on the virtual-agent monitor (§3).
- Auto-promoted leak tickets arrive in **Needs review** with a distinguishing
  signal.

---

## 6. The "on hold / waiting" analysis (why the split above is correct)

"On hold" was overloaded because it conflated **two independent axes**:

- **Axis A — who unblocks it?** system-clock / system-action / customer / carrier.
  (For a carrier or customer wait, the operator can do nothing *right now*.)
- **Axis B — has an operator taken ownership yet?** **pre-human** (never pulled —
  the wait began automatically) vs **operator-owned** (pulled, acted, parked).

Resolution: **pre-human system waits live on the virtual-agent monitor (§3);
operator-owned post-pull waits live in the operator's private On-hold column (§5).**
Same word, two homes, decided by ownership.

### Every waiting scenario in `policies.md`

| Scenario | Blocked on | Who unblocks | On release | Leak / deadline |
|---|---|---|---|---|
| Insufficient funds (`:13–17`) | 2-day clock → system retry | **System** | Automatic; successful retry resolves with no human (`:17`) | 3rd retry fail → escalate (`:16`). *3-vs-4 attempt ambiguity* |
| Expired card (`:23–26`) | **Customer** supplies method | Customer action, or 48h clock | Needs human on expiry — **only if recurring** (`:25`) | **Non-recurring → nothing fires → leak.** Nudge auto-sent (`:24`) |
| Missed installment (`:34–41`) | 7-day grace clock | Auto-reminders d1/d5 (`:35`), early auto-retry (`:38–41`), else escalate d7 (`:37`) | Mixed | **Days 4–7 = hole:** no rule, no owner |
| Dispute in transit (`:51–57`) | **Carrier** delivery scan | Tracking event → re-evaluate | Mixed | Often pre-empted by $200+/high-value triggers (`:53–55`); needs data that doesn't exist |
| Refund — changed mind (`:76–80`) | *nothing* | — | Immediate (resolve or escalate) | No genuine wait |

---

## 7. Promotion triggers (machine → operator, operator → specialist)

Straight from `policies.md`:

- Insufficient funds: **3rd retry fails**, or customer contacts support (`:16`).
- Missed installment: **> 7 days overdue**, or missed on multiple plans (`:37`).
- Expired card: **no response after 48h AND recurring** (`:25`).
- Dispute (item not received): amount **> $200**, high-value customer
  (spend > $2000), or merchant fulfillment history (`:53–55`).
- Unauthorized transaction: **always, immediately** → specialist (`:63–64`).

---

## 8. Policy ambiguities that shape the goal (the "instrument" findings)

These are why the product is as much a **policy-quality instrument** as a queue.
All traced to `policies.md` line numbers:

- **Retry-budget contradiction:** "up to 3 attempts total" (`:13`) vs "when the
  *third retry* fails" (`:16`) — 3 vs 4. At `auto_retry_count = 2` the two readings
  give opposite verdicts on the same ticket (`iss_001`).
- **Installment days 4–7 hole:** auto-resolve stops at day 3 (`:39`), escalation
  starts at day 8 (`:37`); days 4–7 are governed by no rule (`iss_002`).
- **Expired-card non-recurring leak:** `:25` only escalates recurring subscriptions
  after 48h; a non-recurring expired card that gets no customer response is
  released by nothing.
- **Phantom inputs:** rules require data that does not exist in the dataset —
  merchant fulfillment history (`:55`), delivery-confirmation events and customer
  comms history (`:56`). Merchant is a bare string on the transaction.
- **Advisory-vs-hard conflict:** `:54` makes lifetime spend > $2000 a *hard*
  escalation trigger; `:88` makes the same threshold *advisory* ("consider").

**Decision:** we treat these as first-class output — a leak/no-rule ticket is
auto-promoted and **signalized** rather than silently resolved with a guessed
reading.

---

## 9. Cross-cutting principles

- **Volume breaks naive boards.** Auto-resolved traffic is the majority → counts
  and drill-ins, not walls of cards.
- **Not every column move is a drag.** The system fills the shared backlog; the
  clock releases holds; the operator drags only their own lanes.
- **Outcome ≠ routing.** *What was decided* (the lane/terminal state) is a
  different field from *who moves next*. Do not flatten them.

---

## 10. Scope

- **MVP first screen = the Operator board (§5).** Build this one first.
- The virtual-agent monitor (§3) and specialist board (§4) are now **defined as
  the world around it** — that context is what makes the operator board correct —
  but they are later screens.

---

## 11. Deferred / open (to challenge in later sessions)

- Operator **privileges / roles** (standard vs manager vs specialist visibility).
  Current assumption: single standard operator, already "logged in."
- Full design of the **virtual-agent monitor** and **specialist board**.
- The **inter-board handoff UI** (how promotion/escalation looks and feels).
- **Data gaps**: merchant entity, delivery-confirmation events, comms history do
  not exist in the fixtures and several rules depend on them.
- Whether/how the operator board shows the machine's **recommendation + reasoning**
  per ticket (strongly implied — "reasoning already done" — but not yet specced).
