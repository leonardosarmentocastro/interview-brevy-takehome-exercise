# Virtual Agent Monitor — Screen Design Spec

> **Status:** approved design, captured 2026-07-24. Ready for an implementation plan.
> **Scope:** the second of three screens — the **virtual-agent pipeline monitor**.
> Builds on `docs/design/2026-07-23-payment-triage-console-context.md` (the system
> context) and the shipped operator screen (`sample/`).
> **Prototype target:** a static, hand-authored HTML/CSS/JS screen in the same
> spirit as `sample/` — a "dumb template" over the fixtures, not a live engine.
>
> Mockups this spec was derived from (gitignored, throwaway):
> `.superpowers/brainstorm/658045-*/content/monitor-board-v4.html` and
> `drill-view-v1.html`.

---

## 1. What this screen is

The read-only monitor for **Actor 1 — the virtual agent (machine)** in the
three-tier pipeline (context doc §2). It shows everything the automation is
handling with **no human involved**, and lets a human *pull a card out* (to
review or escalate) but never *move cards around* — the clock does that.

- **Primary lens:** *pipeline legibility + provenance + demonstrability.* The
  operator/observer wants to see "what is the robot quietly handling, is it
  keeping up, and where did it punt?" — **situational awareness of the pipe**,
  with **leaks surfaced as the notable exceptions** rather than the whole frame.
- **Instrument value rides on top, not as the frame:** the screen still exposes
  where the written policy cannot decide (context doc §1, §8), but as a byproduct
  (the agent log's leak entries, the drill-in "policy-quality read"), not a
  metrics dashboard.

### 1.1 Revision to the context doc

This supersedes context doc **§3's "no backlog column / instant routing"**
assumption. We add an **Intake lane** (see §3.1). Rationale: (a) a burst of
tickets does **not** resolve in one instant — there is a FIFO processing queue,
and its depth is the "is the agent keeping up?" signal; (b) **provenance** — you
cannot argue a ticket left the vendor (system A) and arrived in the console
(system B) if there is no visible entry point. The rest of §3 stands.

---

## 2. Layout at a glance

Top-to-bottom:

1. **Header** — `◆ Virtual agent — pipeline monitor`, a `machine · read-only`
   tag, and a `live` indicator.
2. **Stat strip** — four totals, always visible (this *is* the agent view):
   Auto-resolved · Waiting (system-managed) · → Sent for human review ·
   → Escalated to specialist.
3. **Agent activity log** — collapsible audit stream (§4).
4. **Three-lane pipeline** — `Intake ⟶ Waiting ⟶ Resolved` (§3).
5. **Floating pipeline nav** — app-wide chrome, pinned bottom-centre (§6).

Dark theme only, reusing the operator screen's tokens (`sample/styles.css`:
`--bg/--col/--col2/--line/--tx*/--ok/--warn/--bad/--info`, mono for data).

---

## 3. The three-lane pipeline

Lanes are **stages of a pipeline**, separated by `⟶` glyphs in wide (~46px)
tracks that echo the bottom nav. Each lane header shows a title + a count; the
**count matches the title's size and colour** (small, colour-matched, not a
giant number — the headline totals already live in the stat strip).

| Lane | Colour | Holds | Moves by |
|---|---|---|---|
| **Intake · unprocessed** | info (blue) | Arrived from vendor, not yet evaluated | System (evaluation) |
| **Waiting · system-managed** | warn (amber) | Machine-held waits (timer / nudge / grace) | System (clock / customer) |
| **Resolved · automatically** | ok (green) | Closed with no human | Terminal |

**Exits are flows, not columns** (mirroring the operator board): "→ human
review" and "→ specialist" leave the screen and appear only in the stat strip
and the agent log. Leaks are the *signalized* exits to human review.

### 3.1 Intake · unprocessed

- **The mouth of the pipe.** Tickets that landed from the vendor feed and haven't
  been evaluated. **Always visible even at count 0** so the entry point is always
  on screen. Near-zero in steady state; fills on bursts.
- Cards show type + amount, the meta line (id · customer · merchant · age), an
  **`evaluating against policy…`** status (blue, animated dot), and a
  **`View ticket (facts only) →`** button (§5.1).
- **Simulator (prototype affordance), co-located at the top of this lane:**
  - `Poll vendor +N` — appends fresh tickets to Intake (cause and effect in one
    place: the tickets appear where you click).
  - `Inject a leak` — summons a policy-couldn't-decide ticket on demand, so the
    signalizing behaviour is **predictable on stage**.
  - `▶ Process next` — advances the queue one ticket.
  - **Tempo:** after a poll, the **first ~5 tickets auto-transit** between lanes
    (so the audience feels how fluid it is), and the **remainder are manual** via
    `Process next` (so the presenter keeps control).
  - Honest framing: this is a **scripted mock** (append pre-baked cards, move on a
    tick), not a real engine — same spirit as `sample/data/decisions.js`.

### 3.2 Waiting · system-managed

- Machine-held waits that **began with zero human involvement** (context doc §6's
  pre-human ownership). The label stays broad ("system-managed"); **each card
  names its own blocker** because the blocker varies:
  - `⏱ retry in 2d` — insufficient funds (`policies.md:13`).
  - `✉ nudge sent — awaiting customer · 48h window` — expired card
    (`policies.md:24`). *Blocked on the customer, not a clock* — this is why the
    lane is "system-managed," not "system clock."
  - `⏳ grace ends in Nd (day 7)` — missed installment (`policies.md:34–41`).
- **Escape hatches on every card** (the required "human is never stuck" affordance,
  context doc §3), using **policy verbiage**:
  - `Request human review →` (→ operator; "human review" per `policies.md:3,63,86`)
  - `Escalate to specialist →` (red on hover)

### 3.3 Resolved · automatically

- The bulk of traffic → a **count tile** + a **last-5 spot-check**, never a wall
  (context doc §9).
- The **5 recent rows are clickable** → open the **full reasoning drawer** (§5.2).
- **`Drill into all 214 ▸`** → the dedicated audit view (§7).

---

## 4. Agent activity log

A collapsible audit stream of everything the agent did autonomously — the
machine's own compliance with `policies.md:90` ("document everything").

- **Collapsed:** shows the **single latest line** + an event count
  (e.g. `10:42:07 · grabbed iss_061 for analysis` · `7 events today ▾`).
- **Expanded:** the full chronological stream, newest first.
- Entry kinds, colour-coded: neutral (grab/nudge/retry-scheduled), **green**
  (auto-resolved), **amber** (leak → human review), **red** (escalated).
- Every `policies.md:NN` in a line is a **link → policy dialog** (§5.3).
- This **replaces** the earlier "exceptions band." It is richer (all agent
  actions, not just leaks) and there is **no "view in operator" link** — a ticket
  can leave to operator *or* specialist, and choosing a destination would imply
  routing intelligence we deliberately do not build for the MVP.

---

## 5. Drawers & dialogs (read-only)

The monitor is read-only, so nothing here has a decision rail or capture form.

### 5.1 Intake ticket drawer — *facts only*

Opened by `View ticket (facts only) →`. Because an intake ticket has **not been
evaluated**, there is nothing to show but facts: an `Intake — not yet evaluated`
pill, ticket table, customer table, and an explicit note — **no recommendation,
no decision timeline, no action column.** Purpose: let the presenter *read what a
generated ticket is about* while staging.

### 5.2 Resolved analysis drawer — *full reasoning*

Opened from a resolved row (in the lane or in the drill-in table). Reuses the
operator detail's main-column pattern (`sample/lib/render.js`): a
`Resolved automatically` pill, the **recommendation block** (green), the
**RULE / EVIDENCE decision timeline** flowing to a conclusion node, a **context**
table, and an **audit footer** (who / when / action / reason / policy version).
No decision rail — the decision is already committed and this screen is read-only.

### 5.3 Policy dialog

Identical to the operator screen: any `policies.md:NN` link opens a centred
dialog showing that line **highlighted in ±4 lines of context**. In the static
prototype the policy text is embedded (the operator sample fetches it; either is
fine as long as behaviour matches).

---

## 6. Floating pipeline nav (app-wide chrome)

A persistent bar, pinned bottom-centre, that makes the three-tier pipeline
(context doc §2) concrete and always reachable:

`[🖥️ Virtual agent / pipeline monitor]  ⟶  [📋 Operator board / for human review]  ⟶  [🔎 Specialist board / for fraud & escalations]`

- **Compact Trello-style pills:** icon + two-line label, vertically centred. All
  three are bordered boxes so the `⟶` gaps read evenly; the **active** view is
  highlighted (info).
- **One-directional `⟶`** encodes the promotion ladder (machine → operator →
  specialist).
- **Shared arrow language:** the per-card escape hatches (`→`) and the nav `⟶`
  teach the same "tickets move right along this pipeline" idea.
- **This is chrome on *all three* views**, not just the monitor. Consequences:
  - The operator board must be **retrofitted** with this nav.
  - The operator board's **`Open agent view ▸` button becomes redundant** (the
    nav replaces it) and is **removed**; the collapsed agent **summary panel
    stays**.

---

## 7. Drill-in view — "Auto-resolved · full log"

What `Drill into all 214 ▸` navigates to. A **sub-view of the agent** (bottom nav
stays on Virtual agent; a `← Back to monitor` breadcrumb sits on top).

- **A dense, searchable/filterable table — not a wall of cards** (the volume trap,
  context doc §9). Columns: `Ticket · Type · Amount · Customer · Resolved · Rule
  fired`.
- **Category filter chips** (All / Refunds / Insufficient funds / Missed
  installments) + a **free-text search** (id / customer / merchant). Count updates
  live.
- **Every row opens the same resolved analysis drawer (§5.2);** rule links open
  the policy dialog.
- **Policy-quality read callout:** a one-line instrument signal, e.g. *"92 of 214
  auto-resolves fired on a single rule (:77) — if it's too permissive, it's
  silently approving at volume."* Surfaces where automation leans hardest on one
  clause. (Keep for the MVP — it's the byproduct value with near-zero cost.)

---

## 8. Cross-cutting: verbiage consistency (both screens)

**Change `NO RULE` → `policy couldn't decide` / `no policy verdict` across the
whole product**, not just this screen. "Policy couldn't decide" is honest for all
leak flavours: a *silent gap* (day 4–7), a *self-contradiction* (3-vs-4, where a
policy exists but is indeterminate), and a *phantom input*. It also matches the
context doc's own language ("where the written policy cannot decide", §1).

- **Touches already-shipped code:** `sample/data/decisions.js` currently emits
  `◆ NO RULE — YOUR CALL`; `sample/lib/render.js` renders the `no_rule` face.
  These must be updated so both screens speak one language.

---

## 9. Data & the fixtures

The five fixture issues map onto the monitor's lanes/exits as follows (agent's
pre-human view):

| Issue | Where on the monitor | Why |
|---|---|---|
| `iss_004` refund, day 3, not shipped | **Resolved (auto)** | `policies.md:77` both conditions met |
| `iss_005` expired card, recurring | **Waiting** (`✉ nudge sent`) | `policies.md:24`, awaiting customer / 48h |
| `iss_001` insufficient funds, retry 2 | **→ human review** (leak) | 3-vs-4 contradiction — policy couldn't decide |
| `iss_002` missed installment, day 5 | **→ human review** (leak) | day 4–7 gap — policy couldn't decide |
| `iss_003` dispute $249 | **→ specialist** | `policies.md:53`, over $200 |

Waiting/Resolved lanes and the drill-in table are padded with **plausible
synthetic rows** consistent with the `AGENT_SUMMARY` totals
(`sample/data/decisions.js`) so the screen reads as "alive" at volume. These are
prototype fixtures, clearly hand-authored.

---

## 10. Scope & non-goals

**In scope:** the monitor board, the two drawers, the policy dialog, the simulator
(scripted), the drill-in table, the app-wide pipeline nav (incl. operator
retrofit), and the both-screens verbiage change (§8).

**Out of scope / deferred:**

- The **specialist board** itself (still a later screen; nav links to a stub).
- A **real decision engine** — this stays a scripted presentation mock over the
  fixtures (the live-engine-vs-mock fork from context doc §12 remains a mock here).
- **Roles/privileges**, inter-board handoff mechanics beyond the visual nav, and
  the missing-data problems (merchant history, comms) — unchanged from context
  doc §12.
