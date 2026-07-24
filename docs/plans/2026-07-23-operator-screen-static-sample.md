# Operator Screen — Static Sample HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable, framework-free HTML sample of the operator screen (board + card + detail view + decision rail) that renders from the real JSON fixtures, so the designed UI becomes a working artifact to demo and build on.

**Architecture:** A vanilla-JS, ESM, no-build static app under `sample/`. Pure functions join the three fixtures with a **static, hand-authored decision layer** and turn the result into HTML strings; a thin `app.js` fetches the fixtures + `policies.md` at runtime and mounts the output into `index.html`. The decision layer is isolated in one module (`data/decisions.js`) so a later phase can replace it with a computed policy engine that emits the same shape. Pure logic is TDD'd with `node --test`; CSS/markup is ported from the approved mockups.

**Tech Stack:** HTML + CSS + vanilla ES modules. Node 18+ built-ins (`node:test`, `node:assert`) for tests. Served with `python3 -m http.server`. Zero runtime and dev dependencies.

## Global Constraints

- **No framework, no build step, no runtime dependencies.** Plain ES modules loaded via `<script type="module">`.
- **Node 18+ for tests**, using only `node:test` and `node:assert/strict`. No test libraries.
- **Data source is the real repo-root files** — `customers.json`, `transactions.json`, `payment_issues.json`, `policies.md`. Fetched at runtime. **Never copy fixture data into source.**
- **Decision layer is STATIC** — verdict / trace / recommended actions are hand-authored in `sample/data/decisions.js`. No policy engine in this phase. Keep it in its own module so a future engine can replace it behind the same shape.
- **Dark theme only.** Palette (from design doc §11.2): `--bad`/red = escalate & breaching, `--ok`/green = go/approve, `--warn`/amber = due-soon, gray = neutral. No blue/purple on tickets.
- **Every `policies.md:NN` reference is a clickable link** that opens a dialog showing that exact line highlighted, read live from the fetched `policies.md`.
- **Run command:** from the repo root, `python3 -m http.server 8000`, then open `http://localhost:8000/sample/`.
- **Design source of truth:** `docs/design/2026-07-23-payment-triage-console-context.md` (esp. §11). Approved mockups live in `.superpowers/brainstorm/.../content/` — `board-cards-v3.html`, `card-anatomy-v5.html`, `detail-view-v4.html`, `decision-rail-v4.html`. Port markup/CSS from these; class names below match them.
- **Board state depicted:** Needs review (shared) = `iss_001`, `iss_002` (both auto-promoted "no rule" leaks). In review (mine) = `iss_003` (dispute, recommend escalate). On hold = empty. Resolved = count only. `iss_004` (auto-resolved refund) and `iss_005` (expired card, agent waiting) appear **only** in the virtual-agent summary counts, not as operator cards.

---

## File Structure

```
sample/
  index.html            # shell: top bar, #board-view and #detail-view containers, policy dialog root
  styles.css            # all styles, dark theme, ported from mockups
  app.js                # browser glue: fetch fixtures + policies, build VMs, mount, wire events
  data/
    decisions.js        # static decision records (DECISIONS map + AGENT_SUMMARY)
  lib/
    viewmodel.js        # pure: join fixtures + decisions -> view models; grouping; date helpers
    render.js           # pure: view model -> HTML strings (card, board, detail, rail, timeline, context)
  tests/
    viewmodel.test.js
    render.test.js
package.json            # { "type": "module" }, test script
```

Responsibilities:
- `lib/viewmodel.js` — all data shaping. No DOM, no HTML. Testable in Node.
- `lib/render.js` — all HTML-string generation. No DOM APIs, no `fetch`. Testable in Node.
- `data/decisions.js` — the only place hand-authored verdicts live. Swappable later.
- `app.js` — the only browser-coupled file (`fetch`, `document`, event listeners). Not unit-tested.

---

## Task 1: Scaffold + view-model join

**Files:**
- Create: `sample/package.json`
- Create: `sample/lib/viewmodel.js`
- Test: `sample/tests/viewmodel.test.js`

**Interfaces:**
- Produces:
  - `daysBetween(laterISO, earlierISO) -> number` (whole days, floored, ≥ 0)
  - `joinIssues({customers, transactions, issues}, decisions, nowISO) -> ViewModel[]`
  - `groupByColumn(viewModels) -> { needs_review: ViewModel[], in_review: ViewModel[], on_hold: ViewModel[], resolved: ViewModel[] }`
  - `ViewModel = { issue, transaction, customer, decision, display }` where
    `display = { id, txnId, typeLabel, amount, amountText, customerName, custId, merchant, ageDays, riskScore, lifetimeSpend, isHighValue }`
  - `typeLabel` map: `decline→"Decline"`, but prefer the decision's own label when present (see Task 2 `display.typeLabel` override). For this task derive a base label from `issue.type`: `{decline:'Decline', missed_installment:'Missed installment', dispute:'Dispute', refund_request:'Refund request'}`.

- [ ] **Step 1: Create `sample/package.json`**

```json
{
  "name": "operator-screen-sample",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test** — `sample/tests/viewmodel.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { daysBetween, joinIssues, groupByColumn } from '../lib/viewmodel.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..'); // repo root
const load = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const fixtures = {
  customers: load('customers.json'),
  transactions: load('transactions.json'),
  issues: load('payment_issues.json'),
};
// minimal decisions stub for this task
const decisions = { iss_003: { lane: 'in_review', owner: 'me' }, iss_001: { lane: 'needs_review', owner: 'team' } };

test('daysBetween returns whole days', () => {
  assert.equal(daysBetween('2025-01-13T00:00:00Z', '2025-01-01T00:00:00Z'), 12);
  assert.equal(daysBetween('2025-01-01T00:00:00Z', '2025-01-13T00:00:00Z'), 0); // clamps at 0
});

test('joinIssues attaches customer + transaction + display', () => {
  const vms = joinIssues(fixtures, decisions, '2025-01-13T12:00:00Z');
  const iss3 = vms.find((v) => v.issue.id === 'iss_003');
  assert.equal(iss3.customer.name, 'Morgan Patel');
  assert.equal(iss3.transaction.id, 'txn_6103');
  assert.equal(iss3.display.amountText, '$249.00');
  assert.equal(iss3.display.ageDays, 12);
  assert.equal(iss3.display.isHighValue, false);
});

test('groupByColumn buckets by decision lane', () => {
  const vms = joinIssues(fixtures, decisions, '2025-01-13T12:00:00Z');
  const grouped = groupByColumn(vms);
  assert.ok(grouped.needs_review.some((v) => v.issue.id === 'iss_001'));
  assert.ok(grouped.in_review.some((v) => v.issue.id === 'iss_003'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd sample && node --test tests/viewmodel.test.js`
Expected: FAIL — `Cannot find module '../lib/viewmodel.js'` (or export not defined).

- [ ] **Step 4: Write `sample/lib/viewmodel.js`**

```js
const TYPE_LABEL = {
  decline: 'Decline',
  missed_installment: 'Missed installment',
  dispute: 'Dispute',
  refund_request: 'Refund request',
};

const HIGH_VALUE_THRESHOLD = 2000;

export function daysBetween(laterISO, earlierISO) {
  const ms = new Date(laterISO).getTime() - new Date(earlierISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const money = (n) => '$' + Number(n).toFixed(2);

export function joinIssues(fixtures, decisions, nowISO) {
  const custById = new Map(fixtures.customers.map((c) => [c.id, c]));
  const txnById = new Map(fixtures.transactions.map((t) => [t.id, t]));

  return fixtures.issues.map((issue) => {
    const customer = custById.get(issue.customer_id) || null;
    const transaction = txnById.get(issue.transaction_id) || null;
    const decision = decisions[issue.id] || null;
    const ageDays = daysBetween(nowISO, issue.created_at);
    const lifetimeSpend = customer ? customer.lifetime_spend : 0;

    return {
      issue,
      transaction,
      customer,
      decision,
      display: {
        id: issue.id,
        txnId: issue.transaction_id,
        typeLabel: TYPE_LABEL[issue.type] || issue.type,
        amount: issue.amount,
        amountText: money(issue.amount),
        customerName: customer ? customer.name : issue.customer_id,
        custId: issue.customer_id,
        merchant: issue.merchant || (transaction ? transaction.merchant : ''),
        ageDays,
        riskScore: customer ? customer.risk_score : 'unknown',
        lifetimeSpend,
        isHighValue: lifetimeSpend > HIGH_VALUE_THRESHOLD,
      },
    };
  });
}

const COLUMNS = ['needs_review', 'in_review', 'on_hold', 'resolved'];

export function groupByColumn(viewModels) {
  const grouped = Object.fromEntries(COLUMNS.map((c) => [c, []]));
  for (const vm of viewModels) {
    const lane = vm.decision && vm.decision.lane;
    if (grouped[lane]) grouped[lane].push(vm);
  }
  return grouped;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd sample && node --test tests/viewmodel.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add sample/package.json sample/lib/viewmodel.js sample/tests/viewmodel.test.js
git commit -m "feat(sample): fixture join + view-model grouping with tests"
```

---

## Task 2: Static decision layer

**Files:**
- Create: `sample/data/decisions.js`
- Test: extend `sample/tests/viewmodel.test.js`

**Interfaces:**
- Produces:
  - `export const DECISIONS` — object keyed by issue id. Each record:
    ```
    {
      lane: 'needs_review'|'in_review'|'on_hold'|'resolved',
      owner: 'team'|'me',
      typeLabelOverride?: string,          // e.g. 'Dispute · item not received'
      statusLabel: string,                 // e.g. 'In review · yours' | 'Needs review'
      urgency: { level: 'breach'|'soon'|'none', label: string },
      why: { face: 'recommend'|'escalate'|'no_rule', lead: string, because: string, ref: number|null },
      trace: Array<{ src: number, status: 'not_met'|'fired'|'cant_evaluate', rule: string, evidence: string }>,
      dataGap: { text: string } | null,
      related: string[],                   // other issue ids for same customer
      actions: {
        recommended: { label: string, sub: string, variant: 'go'|'esc' } | null,
        others: Array<{ label: string, sub?: string, danger?: boolean }>,
      },
      activity: Array<{ t: string, text: string, who: string }>,
    }
    ```
  - `export const AGENT_SUMMARY` — `{ totals: {resolved, waiting, backlog, escalated}, categories: Array<{name, resolved, waiting, backlog, escalated}> }`
- Consumes: nothing (pure data). `viewmodel.joinIssues` will receive `DECISIONS` as its `decisions` arg in `app.js`.

- [ ] **Step 1: Write `sample/data/decisions.js`**

```js
// STATIC decision layer. Hand-authored, traced to policies.md by line number.
// Phase 2 replaces this module with a computed engine emitting the same shape.
export const DECISIONS = {
  iss_003: {
    lane: 'in_review',
    owner: 'me',
    typeLabelOverride: 'Dispute · item not received',
    statusLabel: 'In review · yours',
    urgency: { level: 'soon', label: '⏱ carrier ETA Jan 14' },
    why: {
      face: 'escalate',
      lead: '▲ RECOMMEND ESCALATE TO SPECIALIST',
      because: 'Dispute amount $249 exceeds the $200 escalation trigger — a standard operator can\'t clear this.',
      ref: 53,
    },
    trace: [
      { src: 51, status: 'not_met', rule: 'Auto-resolve if tracking shows "delivered" + 3 days.', evidence: 'Parcel is in transit → can\'t auto-resolve.' },
      { src: 53, status: 'fired', rule: 'Escalate if amount > $200.', evidence: '$249 → triggers escalation.' },
      { src: 54, status: 'not_met', rule: 'Escalate if lifetime spend > $2000.', evidence: 'Morgan is at $312 → no.' },
      { src: 55, status: 'cant_evaluate', rule: 'Escalate if merchant has fulfillment history.', evidence: 'No merchant data exists — see gap below.' },
    ],
    dataGap: { text: 'Rules :55 and :56 need merchant history, delivery-confirmation events and comms history. None exist in the dataset. The verdict holds because :53 fires — but the policy references data we don\'t have.' },
    related: [],
    actions: {
      recommended: { label: '▲ Escalate to specialist', sub: 'amount over $200 · policies.md:53', variant: 'esc' },
      others: [
        { label: 'Put on hold', sub: 'wait on carrier · until Jan 14' },
        { label: 'Resolve manually…', sub: 'refund or deny' },
      ],
    },
    activity: [
      { t: 'Jan 13 08:15', text: 'Ticket created from txn_6103', who: 'system' },
      { t: 'Jan 13 08:15', text: 'Agent evaluated → recommend escalate (:53)', who: 'virtual agent' },
      { t: 'Jan 13 08:15', text: 'Sent to team backlog', who: 'virtual agent' },
      { t: 'Jan 13 11:02', text: 'Picked up → In review', who: 'you' },
    ],
  },

  iss_001: {
    lane: 'needs_review',
    owner: 'team',
    typeLabelOverride: 'Insufficient funds',
    statusLabel: 'Needs review',
    urgency: { level: 'none', label: '⏱ no clock — count disputed' },
    why: {
      face: 'no_rule',
      lead: '◆ NO RULE — YOUR CALL',
      because: 'Policy contradicts itself: "3 attempts total" (:13) vs "third retry fails" (:16).',
      ref: 13,
    },
    trace: [
      { src: 13, status: 'cant_evaluate', rule: 'Auto-retry: up to 3 attempts total.', evidence: 'Original + 2 retries = 3 → reads as exhausted.' },
      { src: 16, status: 'cant_evaluate', rule: 'Escalate when the third retry fails.', evidence: 'Only 2 retries so far → reads as one still owed.' },
    ],
    dataGap: null,
    related: ['iss_004'],
    actions: {
      recommended: null,
      others: [
        { label: 'Schedule 3rd retry', sub: 'if the budget is 4 attempts' },
        { label: 'Escalate to specialist', danger: true },
        { label: 'Put on hold', sub: 'pending a ruling' },
      ],
    },
    activity: [
      { t: 'Jan 13 03:22', text: 'Ticket created from txn_5521', who: 'system' },
      { t: 'Jan 13 03:22', text: 'Agent could not decide — clauses contradict', who: 'virtual agent' },
      { t: 'Jan 13 03:22', text: 'Auto-promoted to team backlog (no rule)', who: 'virtual agent' },
    ],
  },

  iss_002: {
    lane: 'needs_review',
    owner: 'team',
    typeLabelOverride: 'Missed installment',
    statusLabel: 'Needs review',
    urgency: { level: 'soon', label: '⏱ escalates in 2 days (day 7)' },
    why: {
      face: 'no_rule',
      lead: '◆ NO RULE — YOUR CALL',
      because: 'Auto-resolve stops at day 3 (:39); escalation starts at day 8 (:37). Day 5 is covered by no rule.',
      ref: 37,
    },
    trace: [
      { src: 39, status: 'not_met', rule: 'Auto-resolve if ≤ 3 days overdue.', evidence: 'Day 5 → not satisfied.' },
      { src: 37, status: 'not_met', rule: 'Escalate if more than 7 days overdue.', evidence: 'Day 5 → not satisfied either. No rule covers day 5.' },
    ],
    dataGap: null,
    related: [],
    actions: {
      recommended: null,
      others: [
        { label: 'Retry payment' },
        { label: 'Modify plan schedule…', sub: 'new dates / amounts' },
        { label: 'Pause plan', sub: 'stop the clock' },
        { label: 'Escalate to specialist', danger: true },
      ],
    },
    activity: [
      { t: 'Jan 12 00:00', text: 'Ticket created from txn_4892', who: 'system' },
      { t: 'Jan 12 00:00', text: 'Day-5 range not covered by any rule', who: 'virtual agent' },
      { t: 'Jan 12 00:00', text: 'Auto-promoted to team backlog (no rule)', who: 'virtual agent' },
    ],
  },
};

export const AGENT_SUMMARY = {
  totals: { resolved: 214, waiting: 11, backlog: 2, escalated: 2 },
  categories: [
    { name: 'Insufficient funds', resolved: 58, waiting: 3, backlog: 1, escalated: 0 },
    { name: 'Expired card', resolved: 22, waiting: 5, backlog: 0, escalated: 0 },
    { name: 'Missed installment', resolved: 31, waiting: 2, backlog: 1, escalated: 0 },
    { name: 'Disputes', resolved: 9, waiting: 1, backlog: 0, escalated: 2 },
    { name: 'Refunds', resolved: 94, waiting: 0, backlog: 0, escalated: 0 },
  ],
};
```

- [ ] **Step 2: Add a shape test to `sample/tests/viewmodel.test.js`**

```js
import { DECISIONS, AGENT_SUMMARY } from '../data/decisions.js';

test('DECISIONS covers the three board issues with required fields', () => {
  for (const id of ['iss_001', 'iss_002', 'iss_003']) {
    const d = DECISIONS[id];
    assert.ok(d, `${id} present`);
    assert.ok(['needs_review', 'in_review', 'on_hold', 'resolved'].includes(d.lane));
    assert.ok(['recommend', 'escalate', 'no_rule'].includes(d.why.face));
    assert.ok(Array.isArray(d.trace) && d.trace.length > 0);
  }
});

test('AGENT_SUMMARY totals are consistent with categories', () => {
  const sum = (k) => AGENT_SUMMARY.categories.reduce((a, c) => a + c[k], 0);
  for (const k of ['resolved', 'waiting', 'backlog', 'escalated']) {
    assert.equal(AGENT_SUMMARY.totals[k], sum(k), `${k} total matches category sum`);
  }
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd sample && node --test tests/viewmodel.test.js`
Expected: PASS — all tests (5 total).

- [ ] **Step 4: Commit**

```bash
git add sample/data/decisions.js sample/tests/viewmodel.test.js
git commit -m "feat(sample): static hand-authored decision layer + agent summary"
```

---

## Task 3: Render — card + board

**Files:**
- Create: `sample/lib/render.js`
- Test: `sample/tests/render.test.js`

**Interfaces:**
- Produces:
  - `renderCard(vm) -> string` — a `.tk` ticket card. Urgency class from `vm.decision.urgency.level` (`breach→u-breach`, `soon→u-soon`, `none→u-none`). Includes type label, `amountText`, meta line (`id · customer · merchant · Nd`), subtle risk tag (`high-value` if `display.isHighValue` else `risk <score>`), SLA pill, and a "why it's here" chip whose class/text come from `why.face` (`recommend→rec-inline`, `escalate→esc`, `no_rule→none`). Card actions: `Open ticket` + one context action.
  - `renderAgentSummary(agentSummary) -> string` — collapsed `<details>` with the four totals in the summary and a per-category `<table>` in the body.
  - `renderBoard(grouped, agentSummary) -> string` — agent summary + two-zone board (`Team backlog` wrapper with `Needs review`; `My work` wrapper with `In review`, `On hold`, `Resolved`). Every card element carries `data-issue="<id>"` so `app.js` can wire clicks.
- Consumes: `ViewModel` from Task 1, `AGENT_SUMMARY` shape from Task 2.

**Note on markup/CSS:** the class names below intentionally match the mockups `card-anatomy-v5.html` and `board-cards-v3.html`. Task 5 ports the CSS for these classes.

- [ ] **Step 1: Write the failing test** — `sample/tests/render.test.js`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard, renderBoard, renderAgentSummary } from '../lib/render.js';

const vm = {
  issue: { id: 'iss_003', type: 'dispute' },
  display: { id: 'iss_003', typeLabel: 'Dispute · item not received', amountText: '$249.00',
    customerName: 'Morgan Patel', merchant: 'FashionForward', ageDays: 12, riskScore: 'low', isHighValue: false },
  decision: { urgency: { level: 'soon', label: '⏱ carrier ETA Jan 14' },
    why: { face: 'escalate', lead: '▲ RECOMMEND ESCALATE', because: 'over $200', ref: 53 },
    actions: { recommended: { label: '▲ Escalate to specialist', variant: 'esc' }, others: [] } },
};

test('renderCard includes type, amount, urgency class and issue hook', () => {
  const html = renderCard(vm);
  assert.match(html, /data-issue="iss_003"/);
  assert.match(html, /u-soon/);
  assert.match(html, /Dispute · item not received/);
  assert.match(html, /\$249\.00/);
  assert.match(html, /risk low/);
});

test('renderAgentSummary shows totals and is collapsed by details', () => {
  const html = renderAgentSummary({ totals: { resolved: 214, waiting: 11, backlog: 2, escalated: 2 },
    categories: [{ name: 'Refunds', resolved: 94, waiting: 0, backlog: 0, escalated: 0 }] });
  assert.match(html, /<details/);
  assert.match(html, /214/);
  assert.match(html, /Refunds/);
});

test('renderBoard places needs_review under Team backlog', () => {
  const grouped = { needs_review: [vm], in_review: [], on_hold: [], resolved: [] };
  const html = renderBoard(grouped, { totals: { resolved: 0, waiting: 0, backlog: 0, escalated: 0 }, categories: [] });
  assert.match(html, /Team backlog/);
  assert.match(html, /My work/);
  assert.match(html, /data-issue="iss_003"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/render.test.js`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write `sample/lib/render.js` (card + board portion)**

```js
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const URGENCY_CLASS = { breach: 'u-breach', soon: 'u-soon', none: 'u-none' };
const SLA_CLASS = { breach: 'breach', soon: 'soon', none: 'none' };

function riskTag(display) {
  return display.isHighValue
    ? '<span class="rtag hv">high-value</span>'
    : `<span class="rtag">risk ${esc(display.riskScore)}</span>`;
}

// "why it's here" chip on the card
function whyChip(why) {
  if (why.face === 'recommend') return `<div class="rec-inline"><div class="l">✓ ${esc(why.lead)}</div></div>`;
  if (why.face === 'escalate') return `<span class="chip esc">${esc(why.lead)}</span>`;
  return `<span class="chip none">${esc(why.lead)}</span>`; // no_rule
}

// primary card context action (second button)
function cardAction(decision) {
  const rec = decision.actions.recommended;
  if (rec) return `<button class="cbtn go" data-action="recommended">${esc(rec.label.replace(/^[▲✓◆]\s*/, ''))}</button>`;
  return '<button class="cbtn" data-action="open">Review</button>';
}

export function renderCard(vm) {
  const { display: d, decision: dec } = vm;
  return `<div class="tk ${URGENCY_CLASS[dec.urgency.level]}" data-issue="${esc(d.id)}">
    <div class="t1"><b>${esc(dec.typeLabelOverride || d.typeLabel)}</b><span class="amt">${esc(d.amountText)}</span></div>
    <div class="t2">${esc(d.id)} · ${esc(d.customerName)} · ${esc(d.merchant)} · ${d.ageDays}d</div>
    <div class="tags">${riskTag(d)}</div>
    <span class="sla ${SLA_CLASS[dec.urgency.level]}">${esc(dec.urgency.label)}</span>
    ${whyChip(dec.why)}
    <div class="cardacts">
      <button class="cbtn" data-action="open" data-issue="${esc(d.id)}">Open ticket</button>
      ${cardAction(dec)}
    </div>
  </div>`;
}

export function renderAgentSummary(s) {
  const t = s.totals;
  const rows = s.categories.map((c) => `<tr>
      <td class="cat">${esc(c.name)}</td><td>${c.resolved}</td><td>${c.waiting}</td>
      <td class="v-back">${c.backlog || '<span class="z">0</span>'}</td><td class="v-esc">${c.escalated || '<span class="z">0</span>'}</td>
    </tr>`).join('');
  return `<div class="agent">
    <div class="agent-h"><span class="ico">◆</span><h3>Virtual agent — today</h3>
      <span class="tag">machine · read-only</span><button class="agent-btn">Open agent view ▸</button></div>
    <details class="ag">
      <summary>
        <span class="tot ok"><span class="k">Auto-resolved</span><span class="v">${t.resolved}</span></span>
        <span class="tot watch"><span class="k">Waiting</span><span class="v">${t.waiting}</span></span>
        <span class="tot back"><span class="k">Sent to team backlog</span><span class="v">${t.backlog}</span></span>
        <span class="tot esc"><span class="k">Escalated to specialist</span><span class="v">${t.escalated}</span></span>
        <span class="more">per-category</span>
      </summary>
      <table class="mtx"><thead><tr><th>Category</th><th class="h-ok">Auto-resolved</th>
        <th class="h-watch">Waiting</th><th class="h-back">→ Team backlog</th><th class="h-esc">→ Specialist</th></tr></thead>
        <tbody>${rows}</tbody></table>
    </details>
  </div>`;
}

function column(title, count, note, vms, opts = {}) {
  const cards = vms.length ? vms.map(renderCard).join('')
    : `<div class="empty">${esc(opts.empty || 'Nothing here')}</div>`;
  const body = opts.resolvedSummary
    ? `<div class="resolved-sum"><b>${count} resolved by you</b> today<br><span class="mach">+ 214 resolved automatically by the agent</span></div>`
    : cards;
  return `<div class="col ${opts.shared ? 'shared' : ''}">
    <div class="col-h"><h4>${esc(title)}</h4><span class="n">${count}</span></div>
    ${note ? `<p class="col-note">${esc(note)}</p>` : ''}
    ${body}
  </div>`;
}

export function renderBoard(grouped, agentSummary) {
  return `${renderAgentSummary(agentSummary)}
  <div class="twozone">
    <div class="zone team">
      <div class="zhead"><span class="lbl">▤ Team backlog</span><span class="exp">Unassigned — anyone can pick these up.</span></div>
      ${column('Needs review', grouped.needs_review.length, 'Pick one; it moves to your work and leaves others\\' view.', grouped.needs_review, { shared: true, empty: 'Backlog clear' })}
    </div>
    <div class="zone mine">
      <div class="zhead"><span class="lbl">◧ My work</span><span class="exp">Tickets you picked up — only you see &amp; act on these.</span></div>
      <div class="lanes">
        ${column('In review', grouped.in_review.length, 'Actively working now.', grouped.in_review, { empty: 'Nothing in review' })}
        ${column('On hold', grouped.on_hold.length, 'Parked, waiting on a customer/carrier.', grouped.on_hold, { empty: 'Nothing parked' })}
        ${column('Resolved', grouped.resolved.length, 'Closed by you today.', grouped.resolved, { resolvedSummary: true })}
      </div>
    </div>
  </div>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sample && node --test tests/render.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/render.js sample/tests/render.test.js
git commit -m "feat(sample): render card, agent summary, and two-zone board"
```

---

## Task 4: Render — detail view (with rail, timeline, context, policy links)

**Files:**
- Modify: `sample/lib/render.js` (append)
- Test: extend `sample/tests/render.test.js`

**Interfaces:**
- Produces:
  - `policyLink(n) -> string` — `<span class="plink" data-line="N">policies.md:N</span>`
  - `renderDetail(vm) -> string` — full detail view: `← Board` bar, card-like header (ids + status pill, type + amount, SLA badge), recommendation box (`why.lead` + `why.because` + `See policies.md:REF for reference` link when `why.ref` set), `renderTimeline`, optional DATA GAP, Context tables (Customer / Transaction & shipping), Related, and `renderRail`.
  - Internal (exported for tests): `renderTimeline(trace) -> string`, `renderRail(decision) -> string`.
- Consumes: `ViewModel` (Task 1), decision record (Task 2).

**Status-class mapping for timeline:** `not_met→n`, `fired→f`, `cant_evaluate→m`. Status label text: `not_met→'not met'`, `fired→'▲ fired'`, `cant_evaluate→'can\'t evaluate'`.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/render.test.js`

```js
import { renderDetail, renderTimeline, renderRail, policyLink } from '../lib/render.js';

const detailVm = {
  issue: { id: 'iss_003', transaction_id: 'txn_6103', type: 'dispute' },
  transaction: { merchant: 'FashionForward', amount: 249, payment_method: 'card_visa_1234',
    shipping: { carrier: 'UPS', status: 'in_transit', estimated_delivery: '2025-01-14', last_update: '2025-01-12T09:00:00Z', last_location: 'Chicago IL' } },
  customer: { name: 'Morgan Patel', id: 'cust_217', risk_score: 'low', lifetime_spend: 312, lifetime_transactions: 2, account_created: '2024-06-01', disputes_filed: 0 },
  display: { id: 'iss_003', txnId: 'txn_6103', typeLabel: 'Dispute', amountText: '$249.00', customerName: 'Morgan Patel', custId: 'cust_217', merchant: 'FashionForward', ageDays: 12, riskScore: 'low', lifetimeSpend: 312, isHighValue: false },
  decision: {
    typeLabelOverride: 'Dispute · item not received', statusLabel: 'In review · yours',
    urgency: { level: 'soon', label: '⏱ carrier ETA Jan 14' },
    why: { face: 'escalate', lead: '▲ RECOMMEND ESCALATE TO SPECIALIST', because: 'over $200', ref: 53 },
    trace: [{ src: 53, status: 'fired', rule: 'Escalate if amount > $200.', evidence: '$249 → triggers escalation.' }],
    dataGap: { text: 'merchant history missing' }, related: [],
    actions: { recommended: { label: '▲ Escalate to specialist', sub: 'over $200', variant: 'esc' }, others: [{ label: 'Put on hold', sub: 'wait on carrier' }] },
    activity: [{ t: 'Jan 13 08:15', text: 'Ticket created', who: 'system' }],
  },
};

test('policyLink carries the line number', () => {
  assert.match(policyLink(53), /data-line="53"/);
  assert.match(policyLink(53), /policies\.md:53/);
});

test('renderTimeline labels RULE and EVIDENCE with status class', () => {
  const html = renderTimeline([{ src: 53, status: 'fired', rule: 'R', evidence: 'E' }]);
  assert.match(html, /step f/);
  assert.match(html, /RULE/);
  assert.match(html, /EVIDENCE/);
  assert.match(html, /data-line="53"/);
});

test('renderRail groups recommended vs other legal moves', () => {
  const html = renderRail(detailVm.decision);
  assert.match(html, /Recommended/);
  assert.match(html, /Other legal moves/);
  assert.match(html, /Escalate to specialist/);
});

test('renderDetail includes header, reference link, context and rail', () => {
  const html = renderDetail(detailVm);
  assert.match(html, /Dispute · item not received/);
  assert.match(html, /See <span class="plink" data-line="53">policies\.md:53<\/span> for reference/);
  assert.match(html, /Morgan Patel · cust_217/);
  assert.match(html, /Status/); // dedicated shipping status row
  assert.match(html, /Decision · what you do/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/render.test.js`
Expected: FAIL — `renderDetail` etc. not exported.

- [ ] **Step 3: Append detail renderers to `sample/lib/render.js`**

```js
export function policyLink(n) {
  return `<span class="plink" data-line="${n}">policies.md:${n}</span>`;
}

const TL_CLASS = { not_met: 'n', fired: 'f', cant_evaluate: 'm' };
const TL_STATUS = { not_met: 'not met', fired: '▲ fired', cant_evaluate: 'can\\'t evaluate' };

export function renderTimeline(trace) {
  const steps = trace.map((c) => `<div class="step ${TL_CLASS[c.status]}"><div class="dot"></div>
      <div class="shead"><span class="src plink" data-line="${c.src}">policies.md:${c.src}</span><span class="st">${TL_STATUS[c.status]}</span></div>
      <div class="ln"><span class="pfx">RULE</span><span class="val">${esc(c.rule)}</span></div>
      <div class="ln"><span class="pfx">EVIDENCE</span><span class="val">${esc(c.evidence)}</span></div>
    </div>`).join('');
  return `<div class="tl">${steps}
    <div class="step end"><div class="dot"></div><div class="concl">→ ${'conclusion below'}</div></div></div>`;
}

function contextTables(vm) {
  const c = vm.customer, t = vm.transaction, d = vm.display;
  const sh = (t && t.shipping) || null;
  const rows = (pairs) => pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('');
  const custRows = rows([
    ['Name', `${d.customerName} · ${d.custId}`],
    ['Risk', d.riskScore],
    ['Lifetime', `${d.amountTextLifetime || ('$' + Number(d.lifetimeSpend).toFixed(2))} · ${c.lifetime_transactions} transactions`],
    ['Account', `since ${c.account_created}`],
    ['Disputes', `${c.disputes_filed} filed`],
  ]);
  const txnPairs = [
    ['Amount', d.amountText],
    ['Merchant', d.merchant],
    ['Purchased', `${(t.created_at || '').slice(0, 10)} (${d.ageDays}d ago)`],
  ];
  if (sh) txnPairs.push(['Carrier', sh.carrier], ['Status', sh.status], ['ETA', sh.estimated_delivery || '—'], ['Last scan', sh.last_location || '—']);
  return `<div class="ctxwrap">
    <div><h5>Customer</h5><table class="ctable">${custRows}</table></div>
    <div><h5>Transaction &amp; shipping</h5><table class="ctable">${rows(txnPairs)}</table></div>
  </div>`;
}

export function renderRail(decision) {
  const rec = decision.actions.recommended;
  const recBtn = rec
    ? `<div class="grp">Recommended</div>
       <button class="abtn rec-${rec.variant}" data-action="recommended">${esc(rec.label)}${rec.sub ? `<span class="sub">${esc(rec.sub)}</span>` : ''}</button>`
    : '<div class="grp">No recommended action — your call</div>';
  const others = decision.actions.others.map((a) =>
    `<button class="abtn ${a.danger ? 'danger' : ''}" data-action="other">${esc(a.label)}${a.sub ? `<span class="sub">${esc(a.sub)}</span>` : ''}</button>`).join('');
  const activity = (decision.activity || []).map((e) =>
    `<div class="ev"><span class="t">${esc(e.t)}</span><div class="d"><b>${esc(e.text)}</b><br><span class="who">${esc(e.who)}</span></div></div>`).join('');
  return `<div class="rail">
    <div class="dpanel"><div class="h">Decision · what you do</div><div class="body">
      ${recBtn}
      <div class="grp second">Other legal moves</div>
      ${others}
      <div class="logged">Every action writes an audit record — <b>who, when, action, reason, policy version</b>. policies.md:90</div>
    </div></div>
    <div class="sect"><h4 class="rail-h">Activity</h4><div class="act">${activity}</div></div>
  </div>`;
}

export function renderDetail(vm) {
  const d = vm.display, dec = vm.decision;
  const ref = dec.why.ref
    ? `<br><span class="ref">See ${policyLink(dec.why.ref)} for reference</span>` : '';
  const gap = dec.dataGap
    ? `<div class="datagap"><div class="t">DATA GAP</div><div class="b">${esc(dec.dataGap.text)}</div></div>` : '';
  const related = dec.related.length
    ? `Also open for this customer: ${dec.related.map(esc).join(', ')}.`
    : 'No other open tickets for this customer.';
  return `<div class="topbar"><a class="back" href="#" data-action="back">← Board</a></div>
  <div class="grid">
    <div class="main">
      <div class="thead">
        <div class="l1"><span class="ids">${esc(d.id)} · ${esc(d.txnId)}</span><span class="statuspill">${esc(dec.statusLabel)}</span></div>
        <div class="l2"><span class="type">${esc(dec.typeLabelOverride || d.typeLabel)}</span><span class="amt">${esc(d.amountText)}</span></div>
        <div><span class="sla">${esc(dec.urgency.label)}</span></div>
      </div>
      <div class="sect"><div class="rec ${dec.why.face}"><div class="lead">${esc(dec.why.lead)}</div>
        <div class="bc">${esc(dec.why.because)}${ref}</div></div></div>
      <div class="sect"><h4>How the agent reached this</h4>${renderTimeline(dec.trace)}${gap}</div>
      <hr class="rule">
      <div class="sect"><h4>Context</h4>${contextTables(vm)}</div>
      <hr class="rule">
      <div class="sect"><h4>Related</h4><div class="rel">${esc(related)}</div></div>
    </div>
    ${renderRail(dec)}
  </div>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sample && node --test`
Expected: PASS — all viewmodel + render tests.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/render.js sample/tests/render.test.js
git commit -m "feat(sample): render detail view — timeline, context, rail, policy links"
```

---

## Task 5: Styles (dark theme, ported from mockups)

**Files:**
- Create: `sample/styles.css`

**Interfaces:** none (CSS asset). Must define every class used by `render.js` and the shell.

**How to build it:** Consolidate the `<style>` blocks from these mockups into one file, keeping the class names identical:
- Board / zones / columns / agent summary / cards → `.superpowers/brainstorm/.../content/board-cards-v3.html` and `card-anatomy-v5.html`
- Detail view (topbar, thead, rec, timeline `.tl`, datagap, context `.ctable`, rail `.dpanel`, `.abtn`, activity) → `detail-view-v4.html`
- Decision-rail specifics (`.abtn.rec-go/.rec-esc`, `.grp`, `.logged`) → `decision-rail-v4.html`
- Policy modal (`.polmodal`, `.poldialog`, `.polline`, `.polline.hit`) → `detail-view-v4.html`

Put the CSS variables on `:root` (not a wrapper) since this is a real page, not a companion fragment:

- [ ] **Step 1: Create `sample/styles.css` with the theme root and reset**

```css
:root{
  --bg:#0e1116; --col:#161b22; --col2:#1c2230; --line:#2a3140;
  --tx:#e6edf3; --tx2:#9aa7b8; --tx3:#8b97a8;
  --ok:#3fb950; --warn:#d29922; --bad:#f85149; --info:#58a6ff;
  --mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);
  font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
h4,h5{margin:0;font-weight:600}
.hidden{display:none}
```

- [ ] **Step 2: Append all component CSS ported from the mockups**

Copy the rule bodies for every class named in Tasks 3–4 and 6 from the mockup `<style>` blocks listed above. Change any `.ob-wrap`-scoped variable references to the `:root` variables. Required class groups (verify each is present): `.agent .agent-h .agent-btn details.ag summary .tot .mtx`; `.twozone .zone .zhead .lanes .col .col-h .col-note .empty .resolved-sum`; `.tk .t1 .amt .t2 .tags .rtag .sla .chip .rec-inline .cardacts .cbtn`; `.topbar .back .grid .main .rail .thead .statuspill .rec .tl .step .dot .shead .pfx .datagap`; `.ctxwrap .ctable`; `.dpanel .abtn .grp .capture .capfoot .capbtn .logged .act .ev`; `.plink .rule .rel`; `.polmodal .poldialog .polhead .polbody .polline`. Add `.rail-h{font:10.5px var(--mono);letter-spacing:.6px;text-transform:uppercase;color:var(--tx3);margin-bottom:12px}`.

- [ ] **Step 3: Verify no undefined classes**

Run this check from the repo root to list classes used in render.js that are missing from styles.css:

```bash
node -e '
const fs=require("fs");
const render=fs.readFileSync("sample/lib/render.js","utf8");
const css=fs.readFileSync("sample/styles.css","utf8");
const used=new Set([...render.matchAll(/class="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/)).filter(c=>c&&!c.startsWith("${")));
const missing=[...used].filter(c=>!css.includes("."+c));
console.log(missing.length?"MISSING: "+missing.join(", "):"all classes defined");
'
```
Expected: `all classes defined`. Add any missing rule before continuing.

- [ ] **Step 4: Commit**

```bash
git add sample/styles.css
git commit -m "feat(sample): dark-theme stylesheet ported from mockups"
```

---

## Task 6: App bootstrap + shell + navigation

**Files:**
- Create: `sample/index.html`
- Create: `sample/app.js`

**Interfaces:**
- Consumes: `joinIssues`, `groupByColumn` (viewmodel.js); `renderBoard`, `renderDetail` (render.js); `DECISIONS`, `AGENT_SUMMARY` (decisions.js).
- `NOW` constant pinned to `'2025-01-13T12:00:00Z'` so ages/clocks match the fixtures.

- [ ] **Step 1: Create `sample/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payment Issue Console — Operator</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="app" class="wrap"></main>
  <div id="polmodal" class="polmodal hidden">
    <div class="polbackdrop" data-action="close-policy"></div>
    <div class="poldialog">
      <div class="polhead"><span id="polhead-title">policies.md</span><button data-action="close-policy">✕</button></div>
      <div class="polbody" id="polbody"></div>
    </div>
  </div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `sample/app.js` (bootstrap + board/detail navigation)**

```js
import { joinIssues, groupByColumn } from './lib/viewmodel.js';
import { renderBoard, renderDetail } from './lib/render.js';
import { DECISIONS, AGENT_SUMMARY } from './data/decisions.js';

const NOW = '2025-01-13T12:00:00Z';
const app = document.getElementById('app');
let VIEW_MODELS = [];
let POLICY_LINES = [];

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

async function boot() {
  try {
    const [customers, transactions, issues, policiesText] = await Promise.all([
      loadJson('../customers.json'),
      loadJson('../transactions.json'),
      loadJson('../payment_issues.json'),
      fetch('../policies.md').then((r) => r.text()),
    ]);
    POLICY_LINES = policiesText.split('\n');
    VIEW_MODELS = joinIssues({ customers, transactions, issues }, DECISIONS, NOW);
    showBoard();
  } catch (err) {
    app.innerHTML = `<p style="padding:24px;color:var(--bad)">${err.message}. Run <code>python3 -m http.server 8000</code> from the repo root and open <code>/sample/</code>.</p>`;
  }
}

function showBoard() {
  app.innerHTML = renderBoard(groupByColumn(VIEW_MODELS), AGENT_SUMMARY);
  window.scrollTo(0, 0);
}

function showDetail(issueId) {
  const vm = VIEW_MODELS.find((v) => v.issue.id === issueId);
  if (!vm) return;
  app.innerHTML = renderDetail(vm);
  window.scrollTo(0, 0);
}

// event delegation for navigation (policy dialog + capture added in Task 7)
app.addEventListener('click', (e) => {
  const openEl = e.target.closest('[data-action="open"]');
  if (openEl) { showDetail(openEl.getAttribute('data-issue') || openEl.closest('[data-issue]')?.getAttribute('data-issue')); return; }
  const cardEl = e.target.closest('.tk[data-issue]');
  if (cardEl && !e.target.closest('button')) { showDetail(cardEl.getAttribute('data-issue')); return; }
  if (e.target.closest('[data-action="back"]')) { e.preventDefault(); showBoard(); return; }
});

boot();
```

- [ ] **Step 3: Smoke-test the render pipeline headlessly**

Run from repo root (verifies board + detail HTML build without a browser):

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { joinIssues, groupByColumn } from "./sample/lib/viewmodel.js";
import { renderBoard, renderDetail } from "./sample/lib/render.js";
import { DECISIONS, AGENT_SUMMARY } from "./sample/data/decisions.js";
const load=(n)=>JSON.parse(readFileSync(n,"utf8"));
const vms=joinIssues({customers:load("customers.json"),transactions:load("transactions.json"),issues:load("payment_issues.json")},DECISIONS,"2025-01-13T12:00:00Z");
const board=renderBoard(groupByColumn(vms),AGENT_SUMMARY);
const detail=renderDetail(vms.find(v=>v.issue.id==="iss_003"));
if(!board.includes("Team backlog")) throw new Error("board missing zone");
if(!detail.includes("Dispute")) throw new Error("detail missing type");
console.log("smoke OK — board",board.length,"chars, detail",detail.length,"chars");
'
```
Expected: `smoke OK — board <n> chars, detail <n> chars`.

- [ ] **Step 4: Verify in the browser**

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/sample/`. Confirm: agent summary strip (collapsed), two-zone board with iss_001/iss_002 in Needs review and iss_003 in In review; clicking a card opens its detail view; `← Board` returns. Stop the server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add sample/index.html sample/app.js
git commit -m "feat(sample): app shell, fixture loading, board/detail navigation"
```

---

## Task 7: Interactions — policy dialog + action capture popover

**Files:**
- Modify: `sample/app.js` (append handlers)

**Interfaces:**
- Consumes: `POLICY_LINES` (Task 6), the `#polmodal` shell (Task 6), `data-line` on `.plink`, `data-action` on buttons.
- Behavior: clicking any `.plink` opens the policy dialog showing a window of lines around `data-line` with the target highlighted. Clicking a `data-action="recommended"` / `"other"` button opens an inline capture (in the rail) or a popover (on a card) with a **Cancel** (card only) and **Confirm**; Confirm shows a transient "logged" toast and closes; nothing mutates board state in this phase.

- [ ] **Step 1: Append the policy dialog handler to `sample/app.js`**

```js
const polmodal = document.getElementById('polmodal');
const polbody = document.getElementById('polbody');

function openPolicy(line) {
  const start = Math.max(1, line - 4);
  const end = Math.min(POLICY_LINES.length, line + 4);
  let html = '';
  for (let n = start; n <= end; n++) {
    const text = (POLICY_LINES[n - 1] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    html += `<div class="polline${n === line ? ' hit' : ''}"><span class="ln">${n}</span><span>${text || '&nbsp;'}</span></div>`;
  }
  polbody.innerHTML = html;
  polmodal.classList.remove('hidden');
}
function closePolicy() { polmodal.classList.add('hidden'); }

document.addEventListener('click', (e) => {
  const link = e.target.closest('.plink[data-line]');
  if (link) { openPolicy(Number(link.getAttribute('data-line'))); return; }
  if (e.target.closest('[data-action="close-policy"]')) { closePolicy(); return; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePolicy(); });
```

- [ ] **Step 2: Append the capture handler + toast to `sample/app.js`**

```js
function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--col2);border:1px solid var(--ok);color:var(--ok);padding:10px 16px;border-radius:8px;font:13px var(--mono);z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function railCapture(btn) {
  if (btn.parentElement.querySelector('.capture')) return; // already open
  const cap = document.createElement('div');
  cap.className = 'capture';
  cap.innerHTML = `<div class="cl-h">${btn.textContent.replace(/\s+/g, ' ').trim()} — confirm &amp; log</div>
    <div class="fld"><label>Reason (pre-filled from policy)</label><textarea>Confirmed by operator per policy.</textarea></div>
    <div class="capfoot"><button class="capbtn go" data-action="confirm-capture">Confirm</button></div>`;
  btn.insertAdjacentElement('afterend', cap);
}

app.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('.abtn[data-action="recommended"], .abtn[data-action="other"]');
  if (actionBtn) { railCapture(actionBtn); return; }
  if (e.target.closest('[data-action="confirm-capture"]')) {
    const cap = e.target.closest('.capture'); if (cap) cap.remove();
    toast('Action logged — audit record written'); return;
  }
});
```

- [ ] **Step 3: Verify in the browser**

```bash
python3 -m http.server 8000
```
Open `/sample/`, open iss_003. Confirm: clicking `policies.md:53` (in the recommendation or timeline) opens the dialog with line 53 highlighted; Esc / ✕ / backdrop close it. Clicking `Escalate to specialist` in the rail expands an inline capture; `Confirm` shows the "Action logged" toast and closes it. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add sample/app.js
git commit -m "feat(sample): policy dialog + action capture with audit toast"
```

---

## Self-Review

**Spec coverage** (against design doc §11 + this plan's scope):
- Two-zone board, shared/private, aligned, plain-language headers → Task 3 (`renderBoard`), Task 5 (CSS).
- Collapsible agent summary with per-category matrix, corrected "Sent to team backlog" → Task 3 (`renderAgentSummary`), Task 2 (`AGENT_SUMMARY`).
- Card: type+amount, meta line, subtle risk/high-value tag, urgency border+SLA pill, three-faced "why it's here", Open + action → Task 3 (`renderCard`).
- Tight palette, urgency-not-type border, pulse → Task 5 (ported `.u-breach` pulse + palette vars).
- Detail: full view, 60/40, bare top bar, card-like header, RULE/EVIDENCE timeline → conclusion, DATA GAP, context tables with Status row, Related → Task 4 (`renderDetail`, `renderTimeline`, `contextTables`).
- Clickable `policies.md:NN` → dialog reading real `policies.md` → Task 4 (`policyLink`), Task 6 (shell), Task 7 (`openPolicy`).
- State-driven rail, recommended vs other legal moves, always-capture, Cancel-only-on-card, fit-content confirm → Task 4 (`renderRail`), Task 7 (capture). *Note:* card popover Cancel/Confirm markup is exercised by the rail-capture path in this phase; a card-triggered popover is a thin follow-up (deferred, listed below).
- Runs from fixtures, decision layer isolated for later swap → Tasks 1–2, 6.

**Placeholder scan:** no TBD/TODO; every code step contains complete code; CSS task references exact mockup files and enumerates required classes with a verification script.

**Type consistency:** `joinIssues`/`groupByColumn`/`ViewModel.display.*` names match across Tasks 1, 3, 4, 6; decision record shape defined in Task 2 is consumed unchanged in Tasks 3–4; `data-issue` / `data-action` / `data-line` hooks emitted in render match the handlers in Tasks 6–7.

**Deferred (out of scope for this phase, by design):**
- Card-triggered capture *popover* (the rail inline-capture is implemented; the floating card popover with Cancel/Confirm is a small add-on).
- Board state mutation on confirm (cards moving columns) — actions currently log via toast only.
- The live policy engine (Phase 2) and React port (Phase 3).
