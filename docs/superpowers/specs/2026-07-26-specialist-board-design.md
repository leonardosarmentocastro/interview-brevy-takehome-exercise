# Specialist Board — Screen Design Spec

> **Status:** approved design, captured 2026-07-26. Ready for an implementation plan.
> **Scope:** the third and final screen — the **specialist board for fraud &
> escalations** (context doc §4). Builds on
> `docs/superpowers/specs/2026-07-23-payment-triage-console-context.md` (system context),
> `docs/superpowers/specs/2026-07-24-virtual-agent-monitor-design.md` (monitor), and the
> shipped operator screen (`sample/`).
> **Prototype target:** a static, hand-authored HTML/CSS/JS screen in the same
> spirit as `sample/` — a "dumb template" over the fixtures, not a live engine.
>
> Mockups this spec was derived from (gitignored, throwaway), under
> `.superpowers/brainstorm/677503-*/content/`: `board-fullscreen-v4.html`,
> `case-view-v1.html` (dispute), `case-view-fraud-v1.html` (fraud), and the
> `criticality-vs-urgency` / `card-signal-*` exploration series.

---

## 1. What this screen is

The board a **specialist** works — the top tier of the promotion ladder
(context doc §2). It receives what the operator and the agent could not or may
not decide: fraud/unauthorized charges, disputes over $200, high-value
customers, exhausted retries. It is the **terminal tier**.

- **Primary lens: criticality over volume.** The operator board optimises
  *throughput* (hundreds of tickets, shared backlog, fast triage). The
  specialist board is its inverse: **few cases, very high stakes, each one must
  be defensible.** The design spends its attention on *making the right call and
  recording why*, not on cycle time.
- **Terminal by design.** There is **no onward "escalate"** from here. Actions
  are final (confirm fraud, refund, deny, block account) and do **not** return to
  the operator. Movement stays one-directional (context doc §2).
- **Instrument value peaks here.** The fraud path is the product's most acute
  *phantom-input* finding: policy demands device fingerprint, IP and purchase
  patterns (`policies.md:66`) that **do not exist in the dataset** — the
  specialist is asked to adjudicate fraud with zero fraud signals. The screen
  surfaces this honestly rather than faking a verdict (context doc §8).

### 1.1 Same DNA as the operator board, deliberately different where it counts

The specialist tier is a **small team working one shared queue** (assumption:
not a single desk — that would be a single point of failure). With, say, ~10
critical cases across 3 specialists doing deep one-at-a-time work, **ownership
contention is real**, so the operator's "claim it and it leaves everyone else's
view" mechanic earns its place. The board therefore **reuses the operator's
component system** (tokens, two-zone layout, `.tk` card, column notes, capture
component, policy dialog) and diverges only where the criticality lens demands
it (§3, §4, §6).

---

## 2. Criticality and urgency are two axes (not one)

The board's core signal model. They usually correlate but **can diverge**, and
the divergence is exactly what a specialist needs to see:

- **Criticality — stakes if decided wrong.** Mostly intrinsic to the case;
  holds still. **Computed from real fixture fields:** dispute/refund `amount`,
  customer `lifetime_spend` (high-value = costly to lose), `risk_score`, and
  `disputes_filed/won` history. Named vocabulary, **not** a continuous score:
  **Critical / High / Moderate** (same honesty principle as the operator's
  "no confidence score" — see operator context §11.2).
- **Urgency — time pressure.** The **living** number: `deadline + staleness`,
  recomputed over time. A ticket drifts "more urgent" the longer it waits,
  independent of its stakes.

Divergent corners that prove they are two axes: a big refund for a high-value
customer that *just landed* (critical, not yet urgent → claim early on purpose);
a $38 dispute that has *sat unpicked for days* (trivial stakes, but staleness
made it urgent → clear it so the queue keeps moving).

**Consequence for the UI:** they get **separate visual channels** so their two
reds never collide — criticality owns the card's **left border + tier chip**;
urgency owns a **distinct animated bar** (§4).

---

## 3. Board layout

Full-viewport height. **Each column scrolls on its own; the page itself does
not scroll** (a busy escalation queue must not push everything else off-screen).
The pipeline nav **floats fixed** at bottom-centre and never gets pulled down by
content.

Reuses the operator's exact structure (`sample/styles.css`): `--bg/--col/--col2/
--line/--tx*/--ok/--warn/--bad/--info`, `--mono`; `.twozone` grid, `.zone.team`
/ `.zone.mine`, `.zhead .lbl/.exp`, `.col` + `.col-note`, `.tk`, `.pnav`.

### 3.1 Toolbar (specialist-specific addition)

The operator board has no toolbar; the specialist board needs one because
criticality-sorting is its reason to exist.

- **Sort:** default `Criticality → Urgency`. This is a *design default* from the
  primary-lens decision, **not** derived from data — stated plainly so it is not
  mistaken for a computed ranking.
- **Filter chips — grounded in the escalation triggers** (`policies.md` §7 /
  context doc §7): **Fraud** (`:63` unauthorized), **Disputes > $200** (`:53`),
  **Exhausted retries** (`:16` 3rd retry), **High-value** (`:54` spend > $2000).
  Each chip maps to a real clause, not an invented bucket.
- **Free-text search:** id / customer / merchant.

### 3.2 Two zones

| Zone | Column(s) | Owner | Filled / moved by |
|---|---|---|---|
| **Escalation queue** (shared) | **Needs investigation** | Shared — any specialist sees it; `3 online` shown | Agent/operator promote in; anyone can claim |
| **My work** (private) | **Investigating** · **On hold** · **Resolved** | Mine only (Sam) | I claim into Investigating; a clock/party returns holds; I close to Resolved |

- **Column notes** (operator style, below each title): *Needs investigation* —
  "claim one to lock it to you & leave others' view" + a criticality breakdown
  (e.g. `4 Critical · 3 High · 2 Moderate`); *Investigating* — "Actively working
  now"; *On hold* — "Awaiting an external party (bank / carrier / customer)";
  *Resolved* — "Closed by you — terminal".
- **Claim = lock.** Claiming a card moves it to the specialist's private lanes
  and **removes it from every other specialist's view** — identical to the
  operator's pull, so promoting an operator to specialist reuses the exact
  behaviour and mental model.
- **Teammate visibility (decided):** the shared queue shows **only unclaimed**
  cards. No "taken by Dana" ghost card. A teammate-*resolved* case surfaces only
  when searched in a cross-board "all tickets" view — reusing the agent
  drill-in's searchable-table pattern (monitor spec §7) — and ownership lives in
  the ticket's **audit log**, so it needs no card flag.

---

## 4. The card (signal system)

Operator `.tk` anatomy, with the criticality lens layered on:

1. **Type + amount** (`.t1`); **meta line** `id · customer · merchant · age`
   (`.t2`). No decorative icon on the title (e.g. no red circle on "Unauthorized
   charge" — it fought the green of a resolved card and was dropped).
2. **Criticality = the left border + a tier chip** (`Critical` red / `High`
   amber / `Moderate` grey). This repurposes the operator's border slot (which
   there encodes urgency) — the deliberate lens inversion. Optional `high-value`
   tag (`.rtag.hv`), as on the operator card.
3. **Urgency = an animated bar** (specialist-specific). The fill = *time elapsed
   in queue*, creeping toward the **SLA limit** at the far right. The `in queue
   Xm` label rides the fill's leading edge (above the bar); an **icon + word +
   limit value** sits below the bar. A continuous **white sheen sweeps
   left→right** to signal "still advancing". The bar persists through
   Investigating and On hold; it disappears **only at Resolved**.
   - **The end-of-bar icon names *what reaching the limit means*** — the same
     "who unblocks it?" axis from context doc §6:
     - **⚠ act-by** — a deadline the specialist owns; hitting it = SLA breach
       (fraud acting window, exhausted-retry).
     - **⟳ re-evaluate** — an external checkpoint (carrier ETA, bank/customer
       response); hitting it = *new evidence arrives*, not a breach.
   - **Breach behaviour:** when the fill reaches the limit the card **pulses red**
     and **auto-bumps to the top** of the sort (`⤒ bumped to top` tag); the limit
     text flips to "window spent — act now".
4. **Provenance = the "why it's here" slot.** A chain, not a single reason,
   shown in **parallel verbiage** with the distinction carried by font weight:
   **automatically escalated** by agent (agent-direct — e.g. fraud, which skips
   the operator board) vs **manually escalated** by operator (a human handed it
   up). Followed by the trigger + a `policies.md:NN` link.
5. **Actions** (`.cardacts`): **`Open ticket`** + **`Claim`** on shared cards;
   just **`Open ticket`** on claimed cards. Resolved cards show the **outcome**
   (e.g. "fraud confirmed · account blocked · charge reversed" / "dispute denied
   · delivery confirmed").

### 4.1 Colour discipline

Neutral by default; colour is spent only when it signals action. Endline
descriptors (`act-by`, `re-evaluate`) are grey until a breach turns them red.
On any card/detail, blue is reserved for **links and the status pill** only.

---

## 5. The case view (what `Open ticket` opens into)

Full view, **60 / 40** main-column / decision-rail split (operator detail
pattern, `sample/lib/render.js`), each pane scrolling independently, floating
nav retained. Main column order:

1. **Card-like header** — ids → type + amount → criticality tier → the same
   **animated urgency bar** as the board card.
2. **Provenance banner** — the neutral "why it's here": who escalated it and why
   (with policy link). For fraud, it states the case **skipped the operator
   board entirely**.
3. **Case history — the stacked reasoning** (`agent → operator → you`). One
   chronological timeline (operator's RULE/EVIDENCE `.tl` pattern) with each node
   **actor-tagged**: `System` created it → `Agent` read the policy → `Operator`
   claimed/escalated with a **handoff note** → `You` at the **end node** with the
   pending terminal decision. The specialist **inherits** all prior reasoning
   instead of re-deriving it.
   - **Colour rules (disciplined):** `Agent` badge is **grey** like `System` by
     default, and turns **red only on the node whose rule fired**. Policy-line
     links stay blue. **The end node inherits the ticket's criticality colour**
     (Moderate grey / High amber / Critical red) — never a stray blue.
4. **DATA GAP callout** — flags rules referencing absent data. For disputes:
   `:55/:56` (merchant history, delivery confirmation, comms). For fraud it is
   the **headline**, not a footnote (§6).
5. **Context** tables (customer / shipping or charge) and **Related**. Every
   `policies.md:NN` is a link → the **policy dialog** (identical to operator /
   monitor).

### 5.1 Terminal decision rail

State-driven, like the operator's, but **terminal** — no escalate.

- **Dispute:** `Refund customer` (primary) / `Deny dispute` / `Put on hold
  (await carrier)`.
- **Fraud:** `Confirm fraud` (destructive-styled red: block account · reverse
  charge · flag device) / `Clear — legitimate charge` / `Contact customer to
  verify`.
- **Always capture:** every action opens the **same capture component** (reason
  pre-filled from policy) and commits nothing without **Confirm**. It writes the
  audit record — who, when, action, reason, policy version (`policies.md:90`).
- A standing note states this is the top of the ladder: **final, does not return
  to the operator.**

---

## 6. Fraud — the instrument peak

The unauthorized-charge case is where the board's honesty matters most.

- **Agent-direct.** Case history is `System → Agent → You` (no operator node):
  `:63` "auto-resolve never" (grey constraint) + `:64` "escalate always,
  immediately" (red, fired). It skipped the operator board.
- **Data gap as headline.** `:66` requires device fingerprint / IP / purchase
  patterns; none exist. The context table's "The charge" column shows those rows
  literally greyed as **"— not captured (:66)"**, so the hole is *visible*. The
  capture carries a **⚠ decided-without-evidence** inline warning, and the audit
  log records a **data-gap flag**.
- **Honestly staged.** No unauthorized ticket exists in the five fixtures, so
  this case is **synthesised and marked as staged** — the point being that *the
  policy demands a fraud path the data cannot feed*. (Carried forward for a
  future session; see §9.)

---

## 7. Cross-board retrofits (touch already-shipped screens)

Consistency changes that must land on the operator (and where noted, monitor)
screens so the product speaks one language:

- **`Review` → `Claim`.** The operator board's second button (pull into "In
  review") becomes **`Claim`** — "Review" collided with "Open ticket";
  "Claim" clearly means *take ownership*. Applies to both boards.
- **`3 online`** presence indicator — add to the operator's `TEAM BACKLOG` zone
  header too (both are shared-queue team surfaces).
- **Pipeline nav** — already app-wide chrome from the monitor spec; the
  specialist step is now a real destination, no longer a stub.
- (Already decided in the monitor spec: `NO RULE` → **"policy couldn't decide"**
  across the product.)

---

## 8. Data & the fixtures

The escalation-eligible cases map onto the board as follows:

| Issue | On the board | Why |
|---|---|---|
| `iss_003` dispute $249 | **Needs investigation → High** | over $200 (`:53`); operator-escalated; carrier in transit → `⟳ re-evaluate` |
| Unauthorized / fraud | **Needs investigation → Critical** | `:63/:64` always, immediately; agent-direct; **staged** (no fixture) |
| Exhausted retries (e.g. `iss_001` at 3rd fail) | **Needs investigation → High** | `:16` 3rd retry failed; `⚠ act-by` |
| High-value dispute (e.g. involving `cust_315`) | **Needs investigation → Moderate + high-value** | `:54` spend > $2000 |

The queue, My-work lanes, and any drill-in are padded with **plausible synthetic
rows** consistent with the escalation volume, clearly hand-authored — same
approach as the monitor (monitor spec §9).

---

## 9. Scope & non-goals

**In scope:** the full-height board (two zones, toolbar, per-column scroll,
floating nav), the card signal system (criticality border + tier, animated
urgency bar, provenance, terminal outcomes), the case view (stacked case
history, terminal rail + capture, data gap) for both the **dispute** and
**fraud** flavours, the policy dialog, and the cross-board retrofits (§7).

**Out of scope / deferred:**

- A **real decision/criticality engine** — stays a scripted presentation mock
  over the fixtures (the live-engine-vs-mock fork remains a mock, per context
  doc §12).
- **The fraud data problem, properly.** Device fingerprint / IP / purchase
  patterns do not exist; there is no unauthorized fixture. For the MVP we surface
  the gap and stage one case. A real fraud console (ingesting those signals, or a
  disambiguated `policies.md` that stops demanding them) is a **future session** —
  flagged as the sharpest instrument finding to carry forward.
- **Roles / privileges** (what distinguishes an operator from a specialist
  beyond board access), the **recompute cadence** for urgency, the cross-board
  **"all tickets" search** view (reuse of the drill-in table), and inter-board
  handoff mechanics beyond the visual nav — unchanged from context doc §12.
