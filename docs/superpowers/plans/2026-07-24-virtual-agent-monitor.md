# Virtual Agent Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution notes for Cursor (Grok 4.5 High, inline / no stops between tasks):**
> - Run **all 10 tasks in sequence without pausing**. Commit after each task (the commit *is* the checkpoint).
> - After every task that adds JS/data, run `cd sample && npm test` and confirm green before moving on.
> - Tasks 8–10 are visual/interactive (CSS + DOM wiring + a scripted simulator). There are no unit tests for DOM behaviour in this repo — verify by serving the app (`cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`) and checking the described behaviour. If you cannot open a browser, rely on the node tests plus the "static HTML contains hook" assertions and proceed.
> - **Do not** refactor the existing operator-screen code beyond the exact changes named here (verbiage in Task 1, remove one button + add nav in Task 7). Preserve the dark-theme CSS tokens.
> - The design spec is `docs/superpowers/specs/2026-07-24-virtual-agent-monitor-design.md`; read it if a decision is unclear.

**Goal:** Build the read-only virtual-agent pipeline monitor (a second screen) into the existing static `sample/` app: a three-lane pipeline (Intake → Waiting → Resolved), an agent activity log, two read-only drawers, a drill-in audit table, a scripted intake simulator, and an app-wide pipeline nav shared with the operator board.

**Architecture:** Extend the existing vanilla-ES-module app in `sample/`. Pure render functions in `lib/` return HTML strings (unit-tested with `node --test`, asserting substrings — the repo's established pattern). Hand-authored fixtures live in `data/monitor.js` (same spirit as `data/decisions.js`). `app.js` owns routing and DOM interactivity (drawers, filters, simulator). Policy links reuse the existing `policyLink()` helper + the global policy-modal handler already in `app.js`, so `policies.md:NN` dialogs work for free.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert`, static HTML/CSS. No build step, no dependencies.

## Global Constraints

- **Dark theme only**, reuse existing tokens from `sample/styles.css`: `--bg --col --col2 --line --tx --tx2 --tx3 --ok --warn --bad --info --mono`.
- **Read-only screen:** no drag-and-drop, no decision rail, no capture form anywhere in the monitor. The only ticket actions are the escape hatches (request review / escalate) and the simulator.
- **Verbiage:** leaks read **"policy couldn't decide"** (never "NO RULE"), product-wide. Escape hatches read **"Request human review →"** and **"Escalate to specialist →"** (policy language).
- **Policy links** use the existing `policyLink(n)` from `lib/render.js` (class `plink`, `data-line="N"`) so the existing modal handler catches them.
- **Test command:** `cd sample && npm test` (alias for `node --test`). Focused: `node --test tests/monitor.test.js`.
- **Commit style:** conventional commits, one per task.

---

### Task 1: Verbiage change — "policy couldn't decide" (both screens)

Change the leak copy in the already-shipped operator data so both screens speak one language. Only the visible `lead` strings change; the internal `face: 'no_rule'` enum stays.

**Files:**
- Modify: `sample/data/decisions.js` (the `iss_001` and `iss_002` `why.lead` fields, ~lines 47 and 80)
- Test: `sample/tests/viewmodel.test.js` (append one test)

**Interfaces:**
- Consumes: existing `DECISIONS` export.
- Produces: `DECISIONS.iss_001.why.lead` and `DECISIONS.iss_002.why.lead` now contain the string `POLICY COULDN'T DECIDE` and no longer contain `NO RULE`.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/viewmodel.test.js`:

```js
test('leak leads read "policy couldn\'t decide", not "NO RULE"', () => {
  for (const id of ['iss_001', 'iss_002']) {
    assert.match(DECISIONS[id].why.lead, /POLICY COULDN.T DECIDE/i);
    assert.doesNotMatch(DECISIONS[id].why.lead, /NO RULE/i);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/viewmodel.test.js`
Expected: FAIL — the leads still say `◆ NO RULE — YOUR CALL`.

- [ ] **Step 3: Edit the two leads in `sample/data/decisions.js`**

For `iss_001` change:
```js
      lead: '◆ NO RULE — YOUR CALL',
```
to:
```js
      lead: '◆ POLICY COULDN’T DECIDE — YOUR CALL',
```
And make the identical change for `iss_002` (it has the same `lead` line).

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && npm test`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add sample/data/decisions.js sample/tests/viewmodel.test.js
git commit -m "fix(sample): leak copy reads 'policy couldn't decide' on both screens"
```

---

### Task 2: Monitor data module

Hand-authored fixtures for the monitor, mirroring `data/decisions.js`. This is the single source the render functions consume.

**Files:**
- Create: `sample/data/monitor.js`
- Test: `sample/tests/monitor.test.js` (create)

**Interfaces:**
- Produces: `export const MONITOR` with this exact shape:
  - `stats: { resolved, autoPct, waiting, humanReview, escalated }` (numbers)
  - `log: [{ t, kind, text, refs }]` — `kind ∈ 'grab'|'resolved'|'leak'|'escalated'`; `text` is trusted HTML; `refs` is `number[]`
  - `intake: [{ id, type, amountText, meta, facts: { ticket: [k,v][], customer: [k,v][] } }]`
  - `waiting: [{ id, type, amountText, meta, blocker }]`, `waitingMore: number`
  - `resolved: { count, recent: [{ id, typeShort, note }] }`
  - `drill: { total, chips: [{ cat, label, n }], rows: [{ id, cat, type, amountText, customer, time, rule, analysis, txt }], pattern: { count, total, rule } }`
  - `analysis: { [id]: { id, txnId, resolvedAt, type, amountText, rec: { lead, because, ref }, trace: [{ src, status, rule, evidence }], conclusion, context: [k,v][], audit } }`
  - `simPool: [{ id, type, amountText, meta, dest, blocker?, destNote?, rule }]` (`dest ∈ 'waiting'|'resolved'`)
  - `simLeak: { id, type, amountText, meta, dest:'human_review', reason, rule }`

- [ ] **Step 1: Write the failing test** — create `sample/tests/monitor.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONITOR } from '../data/monitor.js';

test('MONITOR log newest-first with valid kinds and numeric refs', () => {
  assert.ok(MONITOR.log.length >= 5);
  for (const e of MONITOR.log) {
    assert.ok(['grab', 'resolved', 'leak', 'escalated'].includes(e.kind));
    assert.ok(Array.isArray(e.refs) && e.refs.every((n) => typeof n === 'number'));
  }
});

test('MONITOR analysis records referenced by drill rows all exist', () => {
  for (const r of MONITOR.drill.rows) {
    assert.ok(MONITOR.analysis[r.analysis], `analysis ${r.analysis} present for row ${r.id}`);
  }
});

test('MONITOR intake items carry facts-only tables', () => {
  for (const it of MONITOR.intake) {
    assert.ok(Array.isArray(it.facts.ticket) && it.facts.ticket.length > 0);
    assert.ok(Array.isArray(it.facts.customer) && it.facts.customer.length > 0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: FAIL — `Cannot find module '../data/monitor.js'`.

- [ ] **Step 3: Create `sample/data/monitor.js`**

```js
// STATIC monitor fixtures. Hand-authored, same spirit as data/decisions.js.
// A future engine could compute these; the render layer only needs this shape.
// `text`, `because`, and `audit` are trusted authored HTML (may contain <b>).
export const MONITOR = {
  stats: { resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 },

  log: [
    { t: '10:42:07', kind: 'grab',      text: 'grabbed <b>iss_061</b> for analysis', refs: [] },
    { t: '10:42:05', kind: 'resolved',  text: '<b>iss_004</b> resolved automatically — refund within 14d, item not shipped', refs: [77] },
    { t: '10:41:58', kind: 'grab',      text: '<b>iss_005</b> nudge sent to customer — expired card, 48h window opened', refs: [24] },
    { t: '10:41:30', kind: 'leak',      text: '<b>iss_002</b> — policy couldn’t decide (day 4–7 gap) → sent for human review', refs: [37] },
    { t: '10:41:12', kind: 'grab',      text: '<b>iss_048</b> retry scheduled — insufficient funds, attempt 2 of 3, next in 2d', refs: [13] },
    { t: '10:40:55', kind: 'leak',      text: '<b>iss_001</b> — policy couldn’t decide (3-vs-4 retry contradiction) → sent for human review', refs: [13, 16] },
    { t: '10:40:31', kind: 'escalated', text: '<b>iss_003</b> escalated to specialist — dispute $249 exceeds $200', refs: [53] },
  ],

  intake: [
    { id: 'iss_061', type: 'Insufficient funds', amountText: '$128.00',
      meta: 'iss_061 · Dana K. · TechGadgets.com · just now',
      facts: {
        ticket: [['Type', 'decline · insufficient_funds'], ['Amount', '$128.00'], ['Merchant', 'TechGadgets.com'], ['Auto-retry count', '1'], ['Arrived', '2025-01-13 10:42 (from vendor feed)']],
        customer: [['Name', 'Dana K. · cust_071'], ['Risk score', 'low'], ['Lifetime spend', '$742.00 · 9 transactions'], ['Account since', '2024-03-11']],
      } },
    { id: 'iss_062', type: 'Refund — changed mind', amountText: '$54.00',
      meta: 'iss_062 · Alex M. · HomeEssentials · just now',
      facts: {
        ticket: [['Type', 'refund_request · changed_mind'], ['Amount', '$54.00'], ['Merchant', 'HomeEssentials'], ['Days since purchase', '2'], ['Arrived', '2025-01-13 10:42 (from vendor feed)']],
        customer: [['Name', 'Alex M. · cust_088'], ['Risk score', 'low'], ['Lifetime spend', '$355.00 · 4 transactions'], ['Account since', '2024-09-02']],
      } },
  ],

  waiting: [
    { id: 'iss_005', type: 'Expired card', amountText: '$34.99', meta: 'iss_005 · Priya S. · SubscriptionBox.co · recurring', blocker: '✉ nudge sent — awaiting customer · 48h window' },
    { id: 'iss_048', type: 'Insufficient funds', amountText: '$89.99', meta: 'iss_048 · Sam T. · TechGadgets.com · attempt 2 of 3', blocker: '⏱ retry in 2d' },
    { id: 'iss_051', type: 'Missed installment', amountText: '$62.50', meta: 'iss_051 · Jordan P. · plan 3/4 · 2d overdue', blocker: '⏳ grace ends in 5d (day 7)' },
  ],
  waitingMore: 8,

  resolved: {
    count: 214,
    recent: [
      { id: 'iss_004', typeShort: 'refund', note: 'within 14d' },
      { id: 'iss_060', typeShort: 'insuff. funds', note: 'retry ok' },
      { id: 'iss_059', typeShort: 'refund', note: 'within 14d' },
      { id: 'iss_058', typeShort: 'missed inst.', note: 'day 2, retried' },
      { id: 'iss_057', typeShort: 'refund', note: 'within 14d' },
    ],
  },

  drill: {
    total: 214,
    chips: [
      { cat: 'all', label: 'All', n: 214 },
      { cat: 'refund', label: 'Refunds', n: 94 },
      { cat: 'decline', label: 'Insufficient funds', n: 58 },
      { cat: 'missed', label: 'Missed installments', n: 31 },
    ],
    rows: [
      { id: 'iss_004', cat: 'refund',  type: 'Refund — changed mind', amountText: '$149.00', customer: 'Morgan L.', time: '10:42:05', rule: 77, analysis: 'iss_004', txt: 'iss_004 morgan homeessentials' },
      { id: 'iss_060', cat: 'decline', type: 'Insufficient funds',     amountText: '$45.00',  customer: 'Dana K.',   time: '10:41:40', rule: 17, analysis: 'iss_060', txt: 'iss_060 dana techgadgets' },
      { id: 'iss_059', cat: 'refund',  type: 'Refund — changed mind', amountText: '$88.00',  customer: 'Lee W.',    time: '10:40:12', rule: 77, analysis: 'iss_004', txt: 'iss_059 lee shopmart' },
      { id: 'iss_058', cat: 'missed',  type: 'Missed installment',     amountText: '$30.00',  customer: 'Kai R.',    time: '10:39:55', rule: 38, analysis: 'iss_058', txt: 'iss_058 kai planpay' },
      { id: 'iss_057', cat: 'refund',  type: 'Refund — changed mind', amountText: '$210.00', customer: 'Nadia S.',  time: '10:38:30', rule: 77, analysis: 'iss_004', txt: 'iss_057 nadia fashionforward' },
      { id: 'iss_055', cat: 'missed',  type: 'Missed installment',     amountText: '$62.50',  customer: 'Omar T.',   time: '10:37:02', rule: 38, analysis: 'iss_058', txt: 'iss_055 omar planpay' },
      { id: 'iss_052', cat: 'decline', type: 'Insufficient funds',     amountText: '$73.20',  customer: 'Dana K.',   time: '10:35:48', rule: 17, analysis: 'iss_060', txt: 'iss_052 dana techgadgets' },
      { id: 'iss_050', cat: 'refund',  type: 'Refund — changed mind', amountText: '$120.00', customer: 'Priya S.',  time: '10:34:11', rule: 77, analysis: 'iss_004', txt: 'iss_050 priya homeessentials' },
      { id: 'iss_047', cat: 'missed',  type: 'Missed installment',     amountText: '$40.00',  customer: 'Sam T.',    time: '10:32:39', rule: 38, analysis: 'iss_058', txt: 'iss_047 sam planpay' },
      { id: 'iss_045', cat: 'refund',  type: 'Refund — changed mind', amountText: '$65.00',  customer: 'Morgan L.', time: '10:30:05', rule: 77, analysis: 'iss_004', txt: 'iss_045 morgan shopmart' },
      { id: 'iss_040', cat: 'decline', type: 'Insufficient funds',     amountText: '$99.00',  customer: 'Jordan P.', time: '10:27:51', rule: 17, analysis: 'iss_060', txt: 'iss_040 jordan techgadgets' },
      { id: 'iss_038', cat: 'refund',  type: 'Refund — changed mind', amountText: '$150.00', customer: 'Nadia S.',  time: '10:25:20', rule: 77, analysis: 'iss_004', txt: 'iss_038 nadia fashionforward' },
    ],
    pattern: { count: 92, total: 214, rule: 77 },
  },

  analysis: {
    iss_004: {
      id: 'iss_004', txnId: 'txn_5998', resolvedAt: '10:42:05', type: 'Refund — changed mind', amountText: '$149.00',
      rec: { lead: '✓ AUTO-RESOLVED — refund approved', because: 'Within the 14-day window (<b>day 3</b>) and the item <b>hasn’t shipped</b> — both conditions for auto-resolve are met, so no human was needed.', ref: 77 },
      trace: [
        { src: 77, status: 'fired',   rule: 'Auto-resolve if within 14 days AND item hasn’t shipped.', evidence: 'Purchased 3 days ago · shipping status = not_shipped → both true.' },
        { src: 79, status: 'applied', rule: 'Installment plans: refund paid installments; cancel remaining.', evidence: '1 of 4 paid → refund the paid portion, cancel the rest of the plan.' },
      ],
      conclusion: '→ Refund approved automatically · no human involved',
      context: [['Customer', 'Morgan L. · cust_042 · risk low'], ['Merchant', 'HomeEssentials'], ['Purchased', '2025-01-10 (3 days ago)'], ['Plan', 'installments 1 / 4 paid']],
      audit: '<b>who:</b> virtual agent · <b>when:</b> 10:42:05 · <b>action:</b> auto-resolve refund · <b>reason:</b> policies.md:77 · <b>policy version:</b> v1',
    },
    iss_060: {
      id: 'iss_060', txnId: 'txn_6210', resolvedAt: '10:41:40', type: 'Insufficient funds', amountText: '$45.00',
      rec: { lead: '✓ AUTO-RESOLVED — retry succeeded', because: 'A scheduled retry cleared within the 3-attempt budget, so the charge went through with no human needed.', ref: 17 },
      trace: [
        { src: 13, status: 'applied', rule: 'Auto-retry: up to 3 attempts total.', evidence: 'Attempt 2 scheduled and executed within budget.' },
        { src: 17, status: 'fired',   rule: 'Resolves on a successful retry.', evidence: 'Retry authorised → balance captured.' },
      ],
      conclusion: '→ Charge captured automatically · no human involved',
      context: [['Customer', 'Dana K. · cust_071 · risk low'], ['Merchant', 'TechGadgets.com'], ['Attempts', '2 of 3']],
      audit: '<b>who:</b> virtual agent · <b>when:</b> 10:41:40 · <b>action:</b> retry captured · <b>reason:</b> policies.md:17 · <b>policy version:</b> v1',
    },
    iss_058: {
      id: 'iss_058', txnId: 'txn_6188', resolvedAt: '10:39:55', type: 'Missed installment', amountText: '$30.00',
      rec: { lead: '✓ AUTO-RESOLVED — installment retried', because: 'Only <b>2 days</b> overdue, customer risk is <b>low</b>, and the retry succeeded — all three auto-resolve conditions are met.', ref: 38 },
      trace: [
        { src: 38, status: 'fired',   rule: 'Auto-resolve if ≤3 days overdue AND low risk AND retry succeeds.', evidence: 'Day 2 · risk low · retry authorised → all true.' },
      ],
      conclusion: '→ Installment captured automatically · no human involved',
      context: [['Customer', 'Kai R. · cust_133 · risk low'], ['Plan', 'installment 2 / 4'], ['Overdue', '2 days']],
      audit: '<b>who:</b> virtual agent · <b>when:</b> 10:39:55 · <b>action:</b> installment retried · <b>reason:</b> policies.md:38 · <b>policy version:</b> v1',
    },
  },

  simPool: [
    { id: 'sim_a', type: 'Refund — changed mind', amountText: '$40.00', meta: 'refund · not shipped · just now', dest: 'resolved', destNote: 'within 14d, not shipped', rule: 77 },
    { id: 'sim_b', type: 'Insufficient funds', amountText: '$76.00', meta: 'decline · attempt 1 · just now', dest: 'waiting', blocker: '⏱ retry in 2d', rule: 13 },
    { id: 'sim_c', type: 'Missed installment', amountText: '$52.00', meta: 'plan 2/4 · day 1 · just now', dest: 'resolved', destNote: 'day 1, low risk, retried', rule: 38 },
    { id: 'sim_d', type: 'Expired card', amountText: '$19.99', meta: 'recurring · just now', dest: 'waiting', blocker: '✉ nudge sent — awaiting customer · 48h window', rule: 24 },
    { id: 'sim_e', type: 'Refund — changed mind', amountText: '$61.00', meta: 'refund · not shipped · just now', dest: 'resolved', destNote: 'within 14d, not shipped', rule: 77 },
    { id: 'sim_f', type: 'Insufficient funds', amountText: '$104.00', meta: 'decline · attempt 1 · just now', dest: 'resolved', destNote: 'retry succeeded', rule: 17 },
  ],
  simLeak: { id: 'sim_leak', type: 'Missed installment', amountText: '$58.00', meta: 'plan 3/4 · day 5 · just now', dest: 'human_review', reason: 'day 4–7 gap', rule: 37 },
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add sample/data/monitor.js sample/tests/monitor.test.js
git commit -m "feat(sample): monitor fixtures — lanes, log, drill, analysis, sim pool"
```

---

### Task 3: Monitor render — header, stat strip, agent log

Start `lib/monitor.js` with the top-of-page pieces. Policy refs render via the shared `policyLink`.

**Files:**
- Create: `sample/lib/monitor.js`
- Test: `sample/tests/monitor.test.js` (append)

**Interfaces:**
- Consumes: `policyLink` from `./render.js`; `MONITOR.stats`, `MONITOR.log`.
- Produces: `renderStatStrip(stats) -> string`, `renderAgentLog(log) -> string`, `renderMonitorHeader() -> string`. Stat `.v` elements carry ids `stat-resolved|stat-waiting|stat-human|stat-escalated`. Log uses `<details class="log">` with `.latest`, `.stream`, `.count`.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/monitor.test.js`:

```js
import { renderStatStrip, renderAgentLog } from '../lib/monitor.js';

test('renderStatStrip shows four totals with stable ids', () => {
  const html = renderStatStrip(MONITOR.stats);
  assert.match(html, /id="stat-resolved"[^>]*>214</);
  assert.match(html, /Sent for human review/);
  assert.match(html, /id="stat-human"[^>]*>2</);
});

test('renderAgentLog is a collapsed details with latest line + policy links', () => {
  const html = renderAgentLog(MONITOR.log);
  assert.match(html, /<details class="log">/);
  assert.match(html, /class="latest"/);
  assert.match(html, /grabbed <b>iss_061<\/b>/);       // latest line, trusted HTML kept
  assert.match(html, /data-line="77"/);                 // a ref rendered as policy link
  assert.match(html, /lrow leak/);                      // leak entries get the class
  assert.match(html, /7 events today/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: FAIL — `renderStatStrip is not exported` / module has no such export.

- [ ] **Step 3: Create `sample/lib/monitor.js` with these exports**

```js
import { policyLink } from './render.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOG_CLASS = { resolved: 'res', leak: 'leak', escalated: 'esc', grab: '' };
const refsHtml = (refs) => (refs && refs.length ? ' · ' + refs.map((n) => policyLink(n)).join(', ') : '');

export function renderMonitorHeader() {
  return `<div class="mhead"><span class="ico">◆</span><h1>Virtual agent — pipeline monitor</h1>
      <span class="tag">machine · read-only</span>
      <span class="live"><span class="dot"></span>live · updates as tickets flow</span></div>
    <p class="sub">Everything the automation is handling with no human involved. You don’t move cards here — the clock does. You can only pull a card out (request review / escalate) if you need to.</p>`;
}

export function renderStatStrip(s) {
  return `<div class="stats">
    <div class="stat ok"><div class="k">Auto-resolved today</div><div class="v" id="stat-resolved">${s.resolved}</div><div class="d">${s.autoPct}% of all intake</div></div>
    <div class="stat watch"><div class="k">Waiting (system-managed)</div><div class="v" id="stat-waiting">${s.waiting}</div><div class="d">retries · nudges · grace clocks</div></div>
    <div class="stat back"><div class="k">→ Sent for human review</div><div class="v" id="stat-human">${s.humanReview}</div><div class="d">policy couldn’t decide</div></div>
    <div class="stat esc"><div class="k">→ Escalated to specialist</div><div class="v" id="stat-escalated">${s.escalated}</div><div class="d">disputes over $200</div></div>
  </div>`;
}

export function renderAgentLog(log) {
  const latest = log[0];
  const rows = log.map((e) =>
    `<div class="lrow ${LOG_CLASS[e.kind]}"><span class="lt">${esc(e.t)}</span><span class="lx">${e.text}${refsHtml(e.refs)}</span></div>`).join('');
  return `<details class="log">
    <summary>
      <span class="llead"><span class="d"></span>Agent log</span>
      <span class="latest"><b>${esc(latest.t)}</b> · ${latest.text}</span>
      <span class="count">${log.length} events today</span>
    </summary>
    <div class="stream">${rows}</div>
  </details>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/monitor.js sample/tests/monitor.test.js
git commit -m "feat(sample): monitor render — header, stat strip, agent log"
```

---

### Task 4: Monitor render — the three-lane pipeline

**Files:**
- Modify: `sample/lib/monitor.js` (add lane/card/simulator/pipeline renderers + `renderMonitor`)
- Test: `sample/tests/monitor.test.js` (append)

**Interfaces:**
- Consumes: `MONITOR` (all lane data).
- Produces:
  - `renderIntakeCard(item) -> string` (root `.tk.eval[data-intake]`, a `View ticket` button `data-action="open-intake" data-id`)
  - `renderWaitCard(item) -> string` (root `.tk.wait[data-wait]`, hatches `data-action="request-review"` / `data-action="escalate"`)
  - `renderPipeline(m) -> string` (lane counts `#count-intake|#count-waiting|#count-resolved`; hosts `#intake-cards`, `#wait-cards`; simulator buttons `data-action="sim-poll|sim-leak|sim-next"`; resolved recent rows `data-action="open-resolved" data-id`; drill button `data-action="drill"`; resolved big number `#count-resolved-big`)
  - `renderMonitor(m) -> string` (header + stat strip + log + pipeline + empty `<div id="drawerHost"></div>`)

- [ ] **Step 1: Write the failing test** — append to `sample/tests/monitor.test.js`:

```js
import { renderIntakeCard, renderWaitCard, renderPipeline, renderMonitor } from '../lib/monitor.js';

test('renderIntakeCard has evaluating state + facts-only view hook', () => {
  const html = renderIntakeCard(MONITOR.intake[0]);
  assert.match(html, /data-intake="iss_061"/);
  assert.match(html, /evaluating against policy/);
  assert.match(html, /data-action="open-intake" data-id="iss_061"/);
});

test('renderWaitCard shows blocker + policy-language hatches', () => {
  const html = renderWaitCard(MONITOR.waiting[0]);
  assert.match(html, /nudge sent — awaiting customer/);
  assert.match(html, /Request human review →/);
  assert.match(html, /Escalate to specialist →/);
  assert.match(html, /data-action="request-review"/);
});

test('renderPipeline has three lanes, counts, sim + drill hooks', () => {
  const html = renderPipeline(MONITOR);
  assert.match(html, /Intake · unprocessed/);
  assert.match(html, /Waiting · system-managed/);
  assert.match(html, /Resolved · automatically/);
  assert.match(html, /id="count-intake"/);
  assert.match(html, /data-action="sim-poll"/);
  assert.match(html, /data-action="drill"/);
  assert.match(html, /data-action="open-resolved" data-id="iss_004"/);
});

test('renderMonitor mounts a drawer host', () => {
  assert.match(renderMonitor(MONITOR), /<div id="drawerHost"><\/div>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Append to `sample/lib/monitor.js`**

```js
export function renderIntakeCard(it) {
  return `<div class="tk eval" data-intake="${esc(it.id)}">
    <div class="t1"><b>${esc(it.type)}</b><span class="amt">${esc(it.amountText)}</span></div>
    <div class="t2">${esc(it.meta)}</div>
    <span class="blocker eval"><span class="evaldot"></span> evaluating against policy…</span>
    <button class="viewbtn" data-action="open-intake" data-id="${esc(it.id)}">View ticket (facts only) →</button>
  </div>`;
}

export function renderWaitCard(it) {
  return `<div class="tk wait" data-wait="${esc(it.id)}">
    <div class="t1"><b>${esc(it.type)}</b><span class="amt">${esc(it.amountText)}</span></div>
    <div class="t2">${esc(it.meta)}</div>
    <span class="blocker">${esc(it.blocker)}</span>
    <div class="hatch">
      <button class="hbtn" data-action="request-review" data-id="${esc(it.id)}">Request human review →</button>
      <button class="hbtn esc" data-action="escalate" data-id="${esc(it.id)}">Escalate to specialist →</button>
    </div>
  </div>`;
}

function renderSimulator() {
  return `<div class="sim">
    <div class="simh">⚡ Simulate intake (prototype)</div>
    <div class="simrow">
      <button class="simbtn" data-action="sim-poll">Poll vendor +5</button>
      <button class="simbtn leak" data-action="sim-leak">Inject a leak</button>
    </div>
    <div class="simrow" style="margin-top:6px"><button class="simbtn step" data-action="sim-next">▶ Process next</button></div>
  </div>`;
}

function renderResolvedPanel(r) {
  const rows = r.recent.map((x) =>
    `<div class="rrow" data-action="open-resolved" data-id="${esc(x.id)}"><span class="rt"><b>${esc(x.id)}</b> · ${esc(x.typeShort)}</span><span class="chev">${esc(x.note)} ›</span></div>`).join('');
  return `<div class="done-tile"><div class="big" id="count-resolved-big">${r.count}</div><div class="cap">resolved today with no human involved</div></div>
    <div class="done-recent"><div class="rh">last 5 resolved — click to inspect reasoning</div>${rows}</div>
    <button class="drill" data-action="drill">Drill into all ${r.count} ▸</button>`;
}

export function renderPipeline(m) {
  const intake = m.intake.map(renderIntakeCard).join('');
  const wait = m.waiting.map(renderWaitCard).join('');
  return `<div class="pipe">
    <div class="lane intake">
      <div class="lane-h"><h3>Intake · unprocessed</h3><span class="n" id="count-intake">${m.intake.length}</span></div>
      <p class="lane-note">The mouth of the pipe — tickets that arrived from the vendor feed and haven’t been evaluated yet. Near-zero in steady state; fills on bursts.</p>
      ${renderSimulator()}
      <div id="intake-cards">${intake}</div>
    </div>
    <div class="arrowcol">⟶</div>
    <div class="lane wait">
      <div class="lane-h"><h3>Waiting · system-managed</h3><span class="n" id="count-waiting">${m.waiting.length + (m.waitingMore || 0)}</span></div>
      <p class="lane-note">The machine is holding these automatically — a timer, a customer nudge, or a grace clock. No human owns them yet. Each card says exactly what it’s blocked on.</p>
      <div id="wait-cards">${wait}</div>
      ${m.waitingMore ? `<div class="intake-empty" style="margin-top:2px">+ ${m.waitingMore} more waiting</div>` : ''}
    </div>
    <div class="arrowcol">⟶</div>
    <div class="lane done">
      <div class="lane-h"><h3>Resolved · automatically</h3><span class="n" id="count-resolved">${m.resolved.count}</span></div>
      <p class="lane-note">The bulk of traffic. Never a wall of cards — a rolling count you drill into. Click any recent ticket to see the agent’s reasoning.</p>
      ${renderResolvedPanel(m.resolved)}
    </div>
  </div>`;
}

export function renderMonitor(m) {
  return `${renderMonitorHeader()}${renderStatStrip(m.stats)}${renderAgentLog(m.log)}${renderPipeline(m)}<div id="drawerHost"></div>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/monitor.js sample/tests/monitor.test.js
git commit -m "feat(sample): monitor render — three-lane pipeline + simulator markup"
```

---

### Task 5: Monitor render — read-only drawers

Two drawers: intake (facts only) and resolved (full agent reasoning). Both return a fully-open `.drawerwrap` that `app.js` injects into `#drawerHost`; closing empties the host.

**Files:**
- Modify: `sample/lib/monitor.js`
- Test: `sample/tests/monitor.test.js` (append)

**Interfaces:**
- Produces:
  - `renderIntakeDrawer(item) -> string` — `.dpill.intake`, ticket + customer tables, a "No agent analysis yet" note, **no** recommendation/timeline. Close hooks `data-action="close-drawer"`.
  - `renderResolvedDrawer(analysis) -> string` — `.dpill.done`, recommendation (`.rec`), green RULE/EVIDENCE timeline ending in a conclusion node, context table, audit footer. Policy links via `policyLink`.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/monitor.test.js`:

```js
import { renderIntakeDrawer, renderResolvedDrawer } from '../lib/monitor.js';

test('renderIntakeDrawer is facts-only (no recommendation/timeline)', () => {
  const html = renderIntakeDrawer(MONITOR.intake[0]);
  assert.match(html, /Intake — not yet evaluated/);
  assert.match(html, /No agent analysis yet/);
  assert.match(html, /data-action="close-drawer"/);
  assert.doesNotMatch(html, /class="rec"/);
  assert.doesNotMatch(html, /class="tl"/);
});

test('renderResolvedDrawer shows recommendation, timeline, audit', () => {
  const html = renderResolvedDrawer(MONITOR.analysis.iss_004);
  assert.match(html, /AUTO-RESOLVED — refund approved/);
  assert.match(html, /class="tl"/);
  assert.match(html, /RULE/);
  assert.match(html, /EVIDENCE/);
  assert.match(html, /data-line="77"/);
  assert.match(html, /policy version:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Append to `sample/lib/monitor.js`**

```js
const kvRows = (pairs) => pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('');

export function renderIntakeDrawer(it) {
  return `<div class="drawerwrap open"><div class="drawerbg" data-action="close-drawer"></div>
    <div class="drawer">
      <div class="dh"><span class="ids">${esc(it.id)}</span><button class="close" data-action="close-drawer">✕</button></div>
      <span class="dpill intake">Intake — not yet evaluated</span>
      <div class="dtype"><span class="ty">${esc(it.type)}</span><span class="am">${esc(it.amountText)}</span></div>
      <div class="dsec">Ticket</div><table class="dtable">${kvRows(it.facts.ticket)}</table>
      <div class="dsec">Customer</div><table class="dtable">${kvRows(it.facts.customer)}</table>
      <div class="dnote"><b>No agent analysis yet.</b> This ticket is still in intake — the engine hasn’t evaluated it against policy. Facts only: no recommendation, no decision timeline. Those appear once it moves into Waiting or Resolved.</div>
    </div></div>`;
}

export function renderResolvedDrawer(a) {
  const steps = a.trace.map((c) =>
    `<div class="step"><div class="dot"></div>
      <div class="shead">${policyLink(c.src)}<span class="st">✓ ${esc(c.status)}</span></div>
      <div class="ln"><span class="pfx">RULE</span><span class="val">${esc(c.rule)}</span></div>
      <div class="ln"><span class="pfx">EVIDENCE</span><span class="val">${esc(c.evidence)}</span></div>
    </div>`).join('');
  return `<div class="drawerwrap open"><div class="drawerbg" data-action="close-drawer"></div>
    <div class="drawer">
      <div class="dh"><span class="ids">${esc(a.id)} · ${esc(a.txnId)}</span><button class="close" data-action="close-drawer">✕</button></div>
      <span class="dpill done">Resolved automatically · ${esc(a.resolvedAt)}</span>
      <div class="dtype"><span class="ty">${esc(a.type)}</span><span class="am">${esc(a.amountText)}</span></div>
      <div class="dsec">What the agent decided</div>
      <div class="rec"><div class="lead">${esc(a.rec.lead)}</div><div class="bc">${a.rec.because} See ${policyLink(a.rec.ref)}.</div></div>
      <div class="dsec">How it got there</div>
      <div class="tl">${steps}<div class="step end"><div class="dot"></div><div class="concl">${esc(a.conclusion)}</div></div></div>
      <div class="dsec">Context</div><table class="dtable">${kvRows(a.context)}</table>
      <div class="dfoot">Logged automatically — ${a.audit}</div>
    </div></div>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/monitor.js sample/tests/monitor.test.js
git commit -m "feat(sample): monitor read-only drawers — intake facts + resolved reasoning"
```

---

### Task 6: Drill-in view render

The searchable/filterable audit table that "Drill into all 214" opens.

**Files:**
- Modify: `sample/lib/monitor.js`
- Test: `sample/tests/monitor.test.js` (append)

**Interfaces:**
- Produces: `renderDrill(drill) -> string`. Back hook `data-action="back-monitor"`; chips `.chip[data-cat][data-action="chip"]` (first has `.on`); search `#q[data-action="drill-search"]`; rows `#rows > tr[data-cat][data-txt][data-action="open-resolved"][data-id=analysisId]`; `#shown`, `#norows`; a `.pattern` callout; and an empty `<div id="drawerHost"></div>`.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/monitor.test.js`:

```js
import { renderDrill } from '../lib/monitor.js';

test('renderDrill has chips, searchable rows, pattern callout, drawer host', () => {
  const html = renderDrill(MONITOR.drill);
  assert.match(html, /data-action="back-monitor"/);
  assert.match(html, /class="chip on" data-cat="all"/);
  assert.match(html, /data-action="drill-search"/);
  assert.match(html, /data-cat="refund" data-txt="[^"]*" data-action="open-resolved" data-id="iss_004"/);
  assert.match(html, /class="pattern"/);
  assert.match(html, /92 of 214/);
  assert.match(html, /<div id="drawerHost"><\/div>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: FAIL — `renderDrill` not exported.

- [ ] **Step 3: Append to `sample/lib/monitor.js`**

```js
export function renderDrill(d) {
  const chips = d.chips.map((c, i) =>
    `<span class="chip ${i === 0 ? 'on' : ''}" data-cat="${esc(c.cat)}" data-action="chip">${esc(c.label)} <span class="c">${c.n}</span></span>`).join('');
  const rows = d.rows.map((r) =>
    `<tr data-cat="${esc(r.cat)}" data-txt="${esc(r.txt)}" data-action="open-resolved" data-id="${esc(r.analysis)}">
      <td class="id">${esc(r.id)}</td><td class="ty">${esc(r.type)}</td><td class="amt">${esc(r.amountText)}</td>
      <td>${esc(r.customer)}</td><td class="time">${esc(r.time)}</td><td class="rule">${policyLink(r.rule)}</td><td class="chev">›</td>
    </tr>`).join('');
  return `<div class="crumb"><a class="back" data-action="back-monitor">← Back to monitor</a>
      <span class="path">Virtual agent / <b>Auto-resolved · full log</b></span></div>
    <div class="head"><h1>Auto-resolved</h1><span class="tag">machine · read-only</span></div>
    <p class="sub">Every ticket the agent closed today with no human involved. Searchable and filterable — click any row to audit the reasoning.</p>
    <div class="toolbar">
      <input class="search" id="q" placeholder="search id, customer, merchant…" data-action="drill-search">
      <div class="chips">${chips}</div>
    </div>
    <table class="tbl"><thead><tr>
      <th>Ticket</th><th>Type</th><th class="r">Amount</th><th>Customer</th><th>Resolved</th><th>Rule fired</th><th></th>
    </tr></thead><tbody id="rows">${rows}</tbody></table>
    <div class="norows" id="norows" style="display:none">No tickets match.</div>
    <div class="count-note">showing <b id="shown">${d.rows.length}</b> of <b>${d.total}</b></div>
    <div class="pattern"><span class="lb">◆ policy-quality read</span>
      <b>${d.pattern.count} of ${d.pattern.total}</b> auto-resolves today fired on a single rule — ${policyLink(d.pattern.rule)} (refund within window, not shipped). If that clause is too permissive, it’s silently approving at volume.</div>
    <div id="drawerHost"></div>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/monitor.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/monitor.js sample/tests/monitor.test.js
git commit -m "feat(sample): drill-in audit table view render"
```

---

### Task 7: Pipeline nav module + operator-board retrofit

The app-wide bottom nav, and removal of the now-redundant "Open agent view" button from the operator board.

**Files:**
- Create: `sample/lib/nav.js`
- Modify: `sample/lib/render.js` (delete the `Open agent view ▸` button in `renderAgentSummary`, ~line 49)
- Test: `sample/tests/monitor.test.js` (append) and `sample/tests/render.test.js` (append one assertion)

**Interfaces:**
- Produces: `renderPipelineNav(active) -> string`, `active ∈ 'agent'|'operator'|'specialist'`. Pills `.pstep[data-view]`, active pill has `.active`; separated by `⟶`.
- Changes: `renderAgentSummary` output no longer contains `Open agent view`.

- [ ] **Step 1: Write the failing tests**

Append to `sample/tests/monitor.test.js`:
```js
import { renderPipelineNav } from '../lib/nav.js';

test('renderPipelineNav marks the active view and links all three', () => {
  const html = renderPipelineNav('agent');
  assert.match(html, /class="pstep active" data-view="agent"/);
  assert.match(html, /data-view="operator"/);
  assert.match(html, /data-view="specialist"/);
  assert.match(html, /for fraud &amp; escalations/);
});
```

Append to `sample/tests/render.test.js`:
```js
test('renderAgentSummary no longer shows the Open agent view button', () => {
  const html = renderAgentSummary({ totals: { resolved: 0, waiting: 0, backlog: 0, escalated: 0 }, categories: [] });
  assert.doesNotMatch(html, /Open agent view/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sample && npm test`
Expected: FAIL — `nav.js` missing; and the "Open agent view" assertion fails (button still present).

- [ ] **Step 3: Create `sample/lib/nav.js`**

```js
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const VIEWS = [
  { view: 'agent',      icon: '🖥️', title: 'Virtual agent',  sub: 'pipeline monitor' },
  { view: 'operator',   icon: '📋', title: 'Operator board',  sub: 'for human review' },
  { view: 'specialist', icon: '🔎', title: 'Specialist board', sub: 'for fraud & escalations' },
];

export function renderPipelineNav(active) {
  const steps = VIEWS.map((v) =>
    `<div class="pstep ${v.view === active ? 'active' : ''}" data-view="${v.view}">
      <span class="pi">${v.icon}</span>
      <span class="ptxt"><span class="pt">${esc(v.title)}</span><span class="ps">${esc(v.sub)}</span></span>
    </div>`);
  return `<div class="pnav">${steps.join('<span class="arr">⟶</span>')}</div>`;
}
```

- [ ] **Step 4: Remove the button in `sample/lib/render.js`**

In `renderAgentSummary`, change:
```js
      <span class="tag">machine · read-only</span><button class="agent-btn">Open agent view ▸</button></div>
```
to:
```js
      <span class="tag">machine · read-only</span></div>
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd sample && npm test`
Expected: PASS (all files).

- [ ] **Step 6: Commit**

```bash
git add sample/lib/nav.js sample/lib/render.js sample/tests/monitor.test.js sample/tests/render.test.js
git commit -m "feat(sample): app-wide pipeline nav + drop redundant agent-view button"
```

---

### Task 8: Styles — port monitor / nav / drawer / table CSS

Append the monitor's styles to `sample/styles.css`. Source of truth: the approved mockups `.superpowers/brainstorm/658045-1784921086/content/monitor-board-v4.html` and `drill-view-v1.html` (read their `<style>` blocks). The block below is the consolidated, deduplicated CSS to add — paste it verbatim at the end of `styles.css`. (Tokens already exist at the top of the file; do not redefine `:root`.)

**Files:**
- Modify: `sample/styles.css` (append)

- [ ] **Step 1: Append this CSS to `sample/styles.css`**

```css
/* ================= virtual-agent monitor ================= */
body{padding-bottom:96px}
.mhead{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.mhead .ico{color:var(--info);font-size:16px}
.mhead h1{font-size:17px;font-weight:600;margin:0;letter-spacing:-.01em}
.mhead .tag{font:9.5px var(--mono);letter-spacing:.5px;text-transform:uppercase;color:var(--tx3);border:1px solid var(--line);border-radius:99px;padding:2px 8px}
.mhead .live{margin-left:auto;font:10.5px var(--mono);color:var(--tx3);display:flex;align-items:center;gap:6px}
.mhead .live .dot{width:7px;height:7px;border-radius:99px;background:var(--ok);animation:live 2s infinite}
@keyframes live{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.5)}50%{box-shadow:0 0 0 4px rgba(63,185,80,0)}}
.sub{color:var(--tx3);font-size:12.5px;margin:0 0 16px}

.stats{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.stat{flex:1;min-width:150px;background:var(--col);border:1px solid var(--line);border-radius:10px;padding:11px 14px}
.stat .k{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--tx3)}
.stat .v{font:700 22px var(--mono);margin-top:3px}
.stat.ok .v{color:var(--ok)} .stat.watch .v{color:var(--warn)} .stat.back .v{color:var(--info)} .stat.esc .v{color:var(--bad)}
.stat .d{font:10.5px var(--mono);color:var(--tx3);margin-top:2px}

.log{border:1px solid var(--line);background:var(--col);border-radius:10px;margin-bottom:16px;overflow:hidden}
.log>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:11px 14px}
.log>summary::-webkit-details-marker{display:none}
.log .llead{font:700 10px var(--mono);letter-spacing:.5px;color:var(--info);text-transform:uppercase;display:flex;align-items:center;gap:7px;flex:none}
.log .llead .d{width:7px;height:7px;border-radius:99px;background:var(--info);animation:live 1.6s infinite}
.log .latest{font:12px var(--mono);color:var(--tx2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log .latest b{color:var(--tx)}
.log .count{margin-left:auto;font:10.5px var(--mono);color:var(--tx3);flex:none}
.log[open] .count::after{content:" ▴"} .log:not([open]) .count::after{content:" ▾"}
.log .stream{border-top:1px solid var(--line);padding:6px 14px 10px;max-height:240px;overflow:auto}
.lrow{display:flex;gap:12px;font:11.5px var(--mono);color:var(--tx3);padding:6px 0;border-bottom:1px solid rgba(42,49,64,.5);line-height:1.5}
.lrow:last-child{border-bottom:0}
.lrow .lt{color:var(--tx3);flex:none;width:64px}
.lrow .lx{color:var(--tx2)} .lrow .lx b{color:var(--tx)}
.lrow.res .lx b{color:var(--ok)} .lrow.leak .lx b{color:var(--warn)} .lrow.esc .lx b{color:var(--bad)}

.pipe{display:grid;grid-template-columns:1fr 46px 1.35fr 46px 1fr;align-items:stretch;gap:0}
.arrowcol{display:flex;align-items:center;justify-content:center;color:var(--tx3);font-size:17px;opacity:.7}
.lane{background:var(--col);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column}
.lane.intake{border-color:rgba(88,166,255,.3)} .lane.wait{border-color:rgba(210,153,34,.32)} .lane.done{border-color:rgba(63,185,80,.28)}
.lane-h{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px}
.lane-h h3{font:700 12.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;margin:0}
.lane.intake h3{color:var(--info)} .lane.wait h3{color:var(--warn)} .lane.done h3{color:var(--ok)}
.lane-h .n{font:700 12.5px var(--mono)}
.lane.intake .n{color:var(--info)} .lane.wait .n{color:var(--warn)} .lane.done .n{color:var(--ok)}
.lane-note{font-size:10.5px;color:var(--tx3);margin:2px 0 10px;line-height:1.4}

.sim{border:1px dashed rgba(88,166,255,.4);background:rgba(88,166,255,.06);border-radius:9px;padding:9px;margin-bottom:11px}
.sim .simh{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--tx3);margin-bottom:7px}
.sim .simrow{display:flex;gap:6px}
.simbtn{flex:1;font:600 11px var(--mono);padding:8px 6px;border-radius:7px;border:1px solid rgba(88,166,255,.45);background:rgba(88,166,255,.1);color:var(--info);cursor:pointer;text-align:center}
.simbtn.leak{border-color:rgba(210,153,34,.45);background:rgba(210,153,34,.1);color:var(--warn)}
.simbtn.step{border-color:var(--line);background:var(--col2);color:var(--tx2)}

.tk.eval{border-left-color:var(--info);opacity:.9}
.tk .t1{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.tk .t1 b{font-size:13px;color:var(--tx)}
.tk .t2{font:12px var(--mono);color:var(--tx3);margin-top:4px}
.blocker{display:inline-flex;gap:5px;margin-top:9px;font:11px var(--mono);padding:2px 8px;border-radius:5px;border:1px solid rgba(210,153,34,.35);background:rgba(210,153,34,.09);color:var(--warn)}
.blocker.eval{border-color:rgba(88,166,255,.35);background:rgba(88,166,255,.09);color:var(--info)}
.evaldot{width:7px;height:7px;border-radius:99px;background:var(--info);display:inline-block;animation:live 1.4s infinite}
.hatch{margin-top:10px;display:flex;gap:6px}
.hbtn{flex:1;font:600 10.5px var(--mono);padding:7px 6px;border-radius:6px;border:1px solid var(--line);background:var(--col);color:var(--tx3);cursor:pointer;text-align:center}
.hbtn:hover{border-color:var(--tx3);color:var(--tx2)}
.hbtn.esc:hover{border-color:rgba(248,81,73,.5);color:var(--bad)}
.viewbtn{margin-top:9px;width:100%;font:600 10.5px var(--mono);padding:7px;border-radius:6px;border:1px solid var(--line);background:var(--col);color:var(--tx3);cursor:pointer}
.viewbtn:hover{border-color:var(--info);color:var(--info)}
.intake-empty{border:1px dotted var(--line);border-radius:9px;color:var(--tx3);font-size:11.5px;text-align:center;padding:14px 8px;font-style:italic}

.done-tile{text-align:center;padding:12px 8px 6px}
.done-tile .big{font:800 32px var(--mono);color:var(--ok)}
.done-tile .cap{font-size:12px;color:var(--tx2);margin-top:2px}
.done-recent{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}
.done-recent .rh{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--tx3);margin-bottom:8px}
.rrow{display:flex;justify-content:space-between;gap:8px;font:11.5px var(--mono);color:var(--tx3);padding:8px 8px;border:1px solid transparent;border-radius:7px;cursor:pointer}
.rrow:hover{border-color:rgba(63,185,80,.4);background:rgba(63,185,80,.06)}
.rrow .rt{color:var(--tx2)} .rrow .rt b{color:var(--tx)} .rrow .chev{color:var(--tx3)}
.drill{margin-top:11px;width:100%;font:600 11px var(--mono);padding:9px;border-radius:7px;border:1px solid rgba(63,185,80,.4);background:rgba(63,185,80,.08);color:var(--ok);cursor:pointer}

.pnav{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:var(--col);border:1px solid var(--line);border-radius:12px;padding:5px;box-shadow:0 12px 40px rgba(0,0,0,.55);z-index:60}
.pstep{display:flex;align-items:center;gap:9px;padding:7px 13px;border:1px solid var(--line);border-radius:9px;cursor:pointer;background:var(--col2)}
.pstep .pi{font-size:15px;line-height:1;flex:none}
.pstep .ptxt{display:flex;flex-direction:column;line-height:1.15}
.pstep .pt{font:600 11.5px system-ui;color:var(--tx3)}
.pstep .ps{font:9px var(--mono);letter-spacing:.2px;color:var(--tx3);opacity:.75}
.pstep:not(.active):hover .pt{color:var(--tx2)}
.pstep.active{background:rgba(88,166,255,.13);border-color:rgba(88,166,255,.45)}
.pstep.active .pt{color:var(--info)} .pstep.active .ps{color:var(--info);opacity:.8}
.pnav .arr{color:var(--tx3);font-size:13px;padding:0 3px;flex:none;opacity:.7}

.drawerwrap{position:fixed;inset:0;z-index:80;display:none}
.drawerwrap.open{display:block}
.drawerbg{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.drawer{position:absolute;top:0;right:0;height:100%;width:min(480px,94vw);background:var(--col);border-left:1px solid var(--line);box-shadow:-20px 0 60px rgba(0,0,0,.6);overflow:auto;padding:18px 20px}
.dh{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.dh .ids{font:12px var(--mono);color:var(--tx3)}
.dh .close{margin-left:auto;background:none;border:1px solid var(--line);color:var(--tx3);border-radius:7px;padding:4px 10px;cursor:pointer;font:13px var(--mono)}
.dpill{display:inline-block;font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;padding:2px 9px;border-radius:99px;margin-bottom:14px}
.dpill.intake{border:1px solid rgba(88,166,255,.4);color:var(--info)} .dpill.done{border:1px solid rgba(63,185,80,.45);color:var(--ok)}
.dtype{display:flex;align-items:baseline;gap:12px;margin-bottom:16px}
.dtype .ty{font-size:19px;font-weight:600} .dtype .am{font:600 19px var(--mono);color:var(--tx)}
.dsec{font:9.5px var(--mono);letter-spacing:.5px;text-transform:uppercase;color:var(--tx3);margin:18px 0 8px}
.dtable{width:100%;border-collapse:collapse;font-size:13px}
.dtable td{padding:7px 2px;border-bottom:1px solid var(--line)}
.dtable td.k{color:var(--tx3);width:44%} .dtable td.v{color:var(--tx)}
.dtable tr:last-child td{border-bottom:0}
.dnote{margin-top:20px;border:1px dashed var(--line);border-radius:8px;padding:11px 13px;font-size:12px;color:var(--tx3);line-height:1.5;background:rgba(139,151,168,.05)}
.dnote b{color:var(--tx2)}
.rec{border-radius:10px;padding:12px 14px;border:1px solid rgba(63,185,80,.32);background:rgba(63,185,80,.08);margin-bottom:6px}
.rec .lead{font:700 13px var(--mono);color:var(--ok);letter-spacing:.2px}
.rec .bc{color:var(--tx2);font-size:13px;margin-top:7px;line-height:1.5} .rec .bc b{color:var(--tx)}
.tl{margin-left:6px;margin-top:6px}
.tl .step{position:relative;padding:0 0 16px 22px;border-left:2px solid var(--line)}
.tl .step:last-child{border-left-color:transparent;padding-bottom:0}
.tl .dot{position:absolute;left:-8px;top:2px;width:14px;height:14px;border-radius:99px;background:var(--bg);border:2px solid var(--ok)}
.tl .step.end .dot{background:var(--ok);border-color:var(--ok);width:16px;height:16px;left:-9px}
.tl .shead{display:flex;gap:10px;align-items:baseline;margin-bottom:7px}
.tl .src{font:11.5px var(--mono)} .tl .st{font:11px var(--mono);color:var(--ok)}
.tl .ln{display:flex;gap:12px;font-size:12.5px;line-height:1.5} .tl .ln + .ln{margin-top:4px}
.tl .pfx{flex:none;width:66px;color:var(--tx3)} .tl .val{color:var(--tx)}
.tl .step.end .concl{font-size:13.5px;font-weight:600;color:var(--ok)}
.dfoot{margin-top:18px;border-top:1px dashed var(--line);padding-top:11px;font:10.5px var(--mono);color:var(--tx3);line-height:1.5}
.dfoot b{color:var(--tx2)}

.crumb{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.crumb .back{color:var(--tx3);font:12.5px var(--mono);text-decoration:none;border:1px solid var(--line);border-radius:7px;padding:6px 11px;cursor:pointer}
.crumb .back:hover{border-color:var(--tx3);color:var(--tx2)}
.crumb .path{font:11.5px var(--mono);color:var(--tx3)} .crumb .path b{color:var(--ok)}
.head{display:flex;align-items:baseline;gap:12px;margin-bottom:4px}
.head h1{font-size:18px;margin:0} .head .tag{font:9.5px var(--mono);letter-spacing:.5px;text-transform:uppercase;color:var(--ok);border:1px solid rgba(63,185,80,.4);border-radius:99px;padding:2px 8px}
.toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.search{flex:1;min-width:200px;background:var(--col);border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:9px 12px;font:12.5px var(--mono)}
.search::placeholder{color:var(--tx3)}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{font:600 11px var(--mono);padding:7px 12px;border-radius:99px;border:1px solid var(--line);background:var(--col2);color:var(--tx3);cursor:pointer}
.chip:hover{border-color:var(--tx3);color:var(--tx2)} .chip.on{border-color:rgba(63,185,80,.5);background:rgba(63,185,80,.1);color:var(--ok)} .chip .c{opacity:.7}
.tbl{width:100%;border-collapse:collapse;font-size:13px;background:var(--col);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.tbl thead th{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--tx3);text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);font-weight:600;background:var(--col2)}
.tbl thead th.r,.tbl td.r{text-align:right}
.tbl tbody tr{cursor:pointer;border-bottom:1px solid rgba(42,49,64,.6)}
.tbl tbody tr:last-child{border-bottom:0} .tbl tbody tr:hover{background:rgba(63,185,80,.05)}
.tbl td{padding:10px 14px;color:var(--tx2)}
.tbl td.id{font:12px var(--mono);color:var(--tx)} .tbl td.amt{font:600 12.5px var(--mono);color:var(--tx);text-align:right}
.tbl td.time{font:11.5px var(--mono);color:var(--tx3)} .tbl td.rule{font:11.5px var(--mono)} .tbl td.rule .plink{color:var(--ok)} .tbl td.chev{color:var(--tx3);text-align:right}
.count-note{font:11px var(--mono);color:var(--tx3);margin-top:10px;text-align:right} .count-note b{color:var(--tx2)}
.norows{padding:26px;text-align:center;color:var(--tx3);font-style:italic;font-size:12.5px}
.pattern{margin-top:16px;border:1px solid rgba(210,153,34,.28);background:rgba(210,153,34,.05);border-radius:9px;padding:11px 14px;font-size:12.5px;color:var(--tx2);line-height:1.5}
.pattern b{color:var(--tx)} .pattern .lb{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--warn);display:block;margin-bottom:5px}
```

- [ ] **Step 2: Verify existing tests still pass** (CSS-only change touches no JS)

Run: `cd sample && npm test`
Expected: PASS (unchanged).

- [ ] **Step 3: Commit**

```bash
git add sample/styles.css
git commit -m "style(sample): monitor, nav, drawer, and drill-table styles"
```

---

### Task 8b (fold into Task 8's commit if preferred): confirm the operator board still renders

Serve and eyeball the operator board (nav is wired in Task 9; here just confirm no CSS regressions). Run `cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`. Expect the board unchanged except the "Open agent view" button is gone. (No commit — verification only.)

---

### Task 9: app.js integration — routing, nav, drawers, drill filtering

Wire the new views into the SPA. All interactivity is event-delegated, matching the existing `app.js` style.

**Files:**
- Modify: `sample/app.js`

**Interfaces:**
- Consumes: `MONITOR`, `renderMonitor`, `renderDrill`, `renderIntakeDrawer`, `renderResolvedDrawer` (monitor); `renderPipelineNav` (nav); existing `policyLink` handler + `POLICY_LINES` modal already in `app.js`.
- Produces DOM behaviour: nav routes between board/monitor/drill; drawers open into `#drawerHost` and close; drill chips + search filter rows; `Escape` closes drawers.

- [ ] **Step 1: Add imports at the top of `sample/app.js`** (after the existing imports)

```js
import { renderMonitor, renderDrill, renderIntakeDrawer, renderResolvedDrawer } from './lib/monitor.js';
import { renderPipelineNav } from './lib/nav.js';
import { MONITOR } from './data/monitor.js';
```

- [ ] **Step 2: Add view renderers.** Update `showBoard` to append the nav, and add `showMonitor` / `showDrill`. Replace the existing `showBoard` function with:

```js
function showBoard() {
  app.innerHTML = renderBoard(groupByColumn(VIEW_MODELS), AGENT_SUMMARY) + renderPipelineNav('operator');
  window.scrollTo(0, 0);
}
function showMonitor() {
  app.innerHTML = renderMonitor(MONITOR) + renderPipelineNav('agent');
  window.scrollTo(0, 0);
}
function showDrill() {
  app.innerHTML = renderDrill(MONITOR.drill) + renderPipelineNav('agent');
  window.scrollTo(0, 0);
}
```

- [ ] **Step 3: Add a toast helper reuse + drawer + nav + drill handlers.** Append this delegated handler block near the bottom of `app.js` (after the existing `boot()` call is fine; `toast` already exists later in the file — if ordering complains, move this block below the `toast` definition):

```js
function openDrawerHTML(html) {
  const host = document.getElementById('drawerHost');
  if (host) host.innerHTML = html;
}
function closeDrawer() {
  const host = document.getElementById('drawerHost');
  if (host) host.innerHTML = '';
}

app.addEventListener('click', (e) => {
  // pipeline nav
  const nav = e.target.closest('.pstep[data-view]');
  if (nav) {
    const view = nav.getAttribute('data-view');
    if (view === 'agent') showMonitor();
    else if (view === 'operator') showBoard();
    else toast('Specialist board — coming soon');
    return;
  }
  // drill navigation
  if (e.target.closest('[data-action="drill"]')) { showDrill(); return; }
  if (e.target.closest('[data-action="back-monitor"]')) { showMonitor(); return; }
  // drawers
  const intakeBtn = e.target.closest('[data-action="open-intake"]');
  if (intakeBtn) {
    const it = MONITOR.intake.find((x) => x.id === intakeBtn.getAttribute('data-id'));
    if (it) openDrawerHTML(renderIntakeDrawer(it));
    return;
  }
  const resolvedEl = e.target.closest('[data-action="open-resolved"]');
  if (resolvedEl) {
    const a = MONITOR.analysis[resolvedEl.getAttribute('data-id')];
    if (a) openDrawerHTML(renderResolvedDrawer(a));
    return;
  }
  if (e.target.closest('[data-action="close-drawer"]')) { closeDrawer(); return; }
  // escape hatches (read-only monitor) — acknowledge via toast for the prototype
  const rev = e.target.closest('[data-action="request-review"]');
  if (rev) { toast(`${rev.getAttribute('data-id')} → sent for human review`); return; }
  const esc = e.target.closest('[data-action="escalate"]');
  if (esc) { toast(`${esc.getAttribute('data-id')} → escalated to specialist`); return; }
  // drill filter chips
  const chip = e.target.closest('.chip[data-action="chip"]');
  if (chip) {
    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
    chip.classList.add('on');
    applyDrillFilter();
    return;
  }
});

app.addEventListener('input', (e) => {
  if (e.target.closest('[data-action="drill-search"]')) applyDrillFilter();
});

function applyDrillFilter() {
  const chip = document.querySelector('.chip.on');
  const cat = chip ? chip.getAttribute('data-cat') : 'all';
  const q = (document.getElementById('q')?.value || '').toLowerCase().trim();
  let n = 0;
  document.querySelectorAll('#rows tr').forEach((tr) => {
    const okCat = cat === 'all' || tr.getAttribute('data-cat') === cat;
    const okQ = !q || tr.getAttribute('data-txt').includes(q);
    const show = okCat && okQ;
    tr.style.display = show ? '' : 'none';
    if (show) n++;
  });
  const shown = document.getElementById('shown');
  if (shown) shown.textContent = n;
  const nr = document.getElementById('norows');
  if (nr) nr.style.display = n ? 'none' : 'block';
}
```

- [ ] **Step 4: Extend the global Escape handler to also close drawers.** The existing `document.addEventListener('keydown', ...)` closes the policy modal; add a drawer close alongside it:

```js
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePolicy(); closeDrawer(); } });
```
(If a `keydown` handler for `closePolicy` already exists, edit that one to also call `closeDrawer()` rather than adding a second listener.)

- [ ] **Step 5: Run the unit tests** (no JS render regressions)

Run: `cd sample && npm test`
Expected: PASS.

- [ ] **Step 6: Browser verification**

Run `cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`. Verify:
- Operator board shows the bottom nav; clicking **Virtual agent** opens the monitor.
- Monitor: agent log expands/collapses; a `policies.md:NN` link opens the policy dialog; an intake **View ticket** opens the facts-only drawer; a resolved recent row opens the reasoning drawer; **Escape** and the backdrop close drawers.
- **Drill into all 214** opens the table; chips + search filter the rows and update "showing N of 214"; a row opens the reasoning drawer; **← Back to monitor** returns.
- Nav **Specialist board** shows the "coming soon" toast.

- [ ] **Step 7: Commit**

```bash
git add sample/app.js
git commit -m "feat(sample): wire monitor + drill routing, drawers, and filters"
```

---

### Task 10: The intake simulator (scripted)

Give the Intake lane life: **Poll vendor +5** appends tickets and the first ~5 auto-transit; the rest advance on **Process next**; **Inject a leak** adds a policy-couldn't-decide ticket that exits to human review. Counts and the agent log update live.

**Files:**
- Modify: `sample/app.js`

**Interfaces:**
- Consumes: `MONITOR.simPool`, `MONITOR.simLeak`, `renderIntakeCard`, `renderWaitCard`, `policyLink` (already imported for the modal), the lane/stat element ids from Tasks 3–4.
- Produces: DOM mutation only.

- [ ] **Step 1: Import the two card renderers.** Extend the monitor import in `app.js`:

```js
import { renderMonitor, renderDrill, renderIntakeDrawer, renderResolvedDrawer, renderIntakeCard, renderWaitCard } from './lib/monitor.js';
```

- [ ] **Step 2: Add the simulator engine.** Append to `app.js`:

```js
const SIM = { queue: [], poolIdx: 0, autoBudget: 5, uid: 0 };

function bump(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String((parseInt(el.textContent, 10) || 0) + delta);
}
function nowClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function logLine(kind, html, refs) {
  const stream = document.querySelector('.log .stream');
  const latest = document.querySelector('.log .latest');
  const count = document.querySelector('.log .count');
  if (!stream) return;
  const t = nowClock();
  const cls = { resolved: 'res', leak: 'leak', escalated: 'esc', grab: '' }[kind] || '';
  const refsHtml = refs && refs.length ? ' · ' + refs.map((n) => policyLink(n)).join(', ') : '';
  stream.insertAdjacentHTML('afterbegin', `<div class="lrow ${cls}"><span class="lt">${t}</span><span class="lx">${html}${refsHtml}</span></div>`);
  if (latest) latest.innerHTML = `<b>${t}</b> · ${html}`;
  if (count) count.textContent = `${stream.children.length} events today`;
}
function makeSimTicket(base) {
  SIM.uid += 1;
  const id = `${base.id}_${SIM.uid}`;
  return { ...base, id, meta: base.meta.replace(/^[^·]+·/, `${id} ·`) };
}
function processOne() {
  const entry = SIM.queue.shift();
  if (!entry) return false;
  const card = document.querySelector(`[data-intake="${entry.id}"]`);
  if (card) card.remove();
  bump('count-intake', -1);
  if (entry.dest === 'waiting') {
    document.getElementById('wait-cards').insertAdjacentHTML('afterbegin', renderWaitCard(entry));
    bump('count-waiting', 1); bump('stat-waiting', 1);
    logLine('grab', `<b>${entry.id}</b> holding — ${entry.blocker.replace(/^[^ ]+ /, '')}`, entry.rule ? [entry.rule] : []);
  } else if (entry.dest === 'resolved') {
    bump('count-resolved', 1); bump('count-resolved-big', 1); bump('stat-resolved', 1);
    logLine('resolved', `<b>${entry.id}</b> resolved automatically — ${entry.destNote}`, entry.rule ? [entry.rule] : []);
  } else if (entry.dest === 'human_review') {
    bump('stat-human', 1);
    logLine('leak', `<b>${entry.id}</b> — policy couldn’t decide (${entry.reason}) → sent for human review`, entry.rule ? [entry.rule] : []);
  }
  return true;
}
function simEnqueue(entry) {
  const host = document.getElementById('intake-cards');
  if (!host) return;
  host.insertAdjacentHTML('beforeend', renderIntakeCard(entry));
  SIM.queue.push(entry);
  bump('count-intake', 1);
}
function autoRun() {
  if (SIM.autoBudget <= 0 || SIM.queue.length === 0) return;
  SIM.autoBudget -= 1;
  processOne();
  setTimeout(autoRun, 1100);
}
function simPoll() {
  for (let i = 0; i < 5; i++) {
    const base = MONITOR.simPool[SIM.poolIdx % MONITOR.simPool.length];
    SIM.poolIdx += 1;
    simEnqueue(makeSimTicket(base));
  }
  autoRun();
}
function simLeak() { simEnqueue(makeSimTicket(MONITOR.simLeak)); }
function simNext() { processOne(); }
```

- [ ] **Step 3: Route the simulator buttons.** In the `app.addEventListener('click', ...)` block from Task 9, add these branches (near the drill/drawer branches):

```js
  if (e.target.closest('[data-action="sim-poll"]')) { simPoll(); return; }
  if (e.target.closest('[data-action="sim-leak"]')) { simLeak(); return; }
  if (e.target.closest('[data-action="sim-next"]')) { simNext(); return; }
```

- [ ] **Step 4: Run the unit tests** (no render regressions)

Run: `cd sample && npm test`
Expected: PASS.

- [ ] **Step 5: Browser verification**

Serve and open the monitor. Verify:
- **Poll vendor +5** appends 5 "evaluating…" cards to Intake; over the next few seconds the first 5 auto-move to Waiting/Resolved, the Intake count drops, Waiting/Resolved counts + stat tiles rise, and the agent log gains a line per transition (latest line + count update).
- After the auto budget is spent, a second **Poll vendor +5** leaves cards in Intake until you press **▶ Process next**, which advances one at a time.
- **Inject a leak** adds one Intake card; **Process next** removes it, logs "policy couldn't decide … → sent for human review", and increments the "Sent for human review" tile.

- [ ] **Step 6: Commit**

```bash
git add sample/app.js
git commit -m "feat(sample): scripted intake simulator — poll, auto-then-manual, leak"
```

---

## Self-Review (completed while writing)

- **Spec coverage:** §2 header/stat strip → Task 3; §3 lanes/simulator/blockers/hatches → Tasks 2,4,10; §4 agent log → Task 3; §5 drawers + policy dialog → Task 5 (dialog reuses existing handler, Task 9); §6 nav + operator retrofit → Task 7,9; §7 drill-in table → Task 6,9; §8 verbiage both screens → Task 1; §9 fixture mapping → Task 2; §10 scope (scripted mock, specialist stub) → Task 10 + nav "coming soon" toast. All covered.
- **Placeholder scan:** none — every step has concrete code or an exact command.
- **Type/name consistency:** data-action names, element ids (`stat-*`, `count-*`), and function names are consistent between the render tasks that emit them (2–7) and the wiring tasks that consume them (9–10); drawer host id `drawerHost` is identical in `renderMonitor` and `renderDrill`; `analysis` ids referenced by drill rows all exist in `MONITOR.analysis` (asserted in Task 2).

---

## Handoff prompt (paste into Cursor for Grok 4.5 High)

> Execute the implementation plan at `docs/superpowers/plans/2026-07-24-virtual-agent-monitor.md` end-to-end, all 10 tasks, without stopping between tasks. It extends the existing static app in `sample/` (vanilla ES modules, `node --test`). For each task: apply the exact file changes shown, then run `cd sample && npm test` and confirm green, then commit with the message given. Tasks 8–10 add CSS and DOM behaviour with no unit tests — after those, serve the app (`python3 -m http.server 8000` from the repo root, open `/sample/`) and confirm the behaviour described in each task's "Browser verification" step. Do not refactor existing operator-screen code beyond the changes named in Tasks 1 and 7. Keep the dark-theme CSS tokens. The design rationale is in `docs/superpowers/specs/2026-07-24-virtual-agent-monitor-design.md` if a choice is unclear.
