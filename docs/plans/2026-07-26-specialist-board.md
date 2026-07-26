# Specialist Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution notes (same repo/toolchain as the monitor plan):**
> - Run the 6 tasks in sequence. Commit after each task (the commit *is* the checkpoint).
> - After every task that adds JS/data, run `cd sample && npm test` and confirm green before moving on.
> - Tasks 5–6 are visual/interactive (DOM wiring + CSS). There are no DOM unit tests in this repo — verify by serving the app (`cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`, click the **Specialist board** pill in the bottom nav) and checking the described behaviour. If you cannot open a browser, rely on the node tests plus the "static HTML contains hook" assertions and proceed.
> - **Do not** refactor existing operator/monitor code beyond the exact changes named here (Task 1 retrofits, Task 5 wiring). Preserve the dark-theme CSS tokens.
> - The design spec is `docs/design/2026-07-26-specialist-board-design.md`; read it if a decision is unclear.

**Goal:** Build the specialist board (fraud & escalations) — the third and final screen — into the existing static `sample/` app: a full-height, per-column-scrolling board (shared escalation queue + private lifecycle lanes), a criticality/urgency card signal system, and a case view that stacks agent→operator→you reasoning into a terminal decision rail.

**Architecture:** Extend the existing vanilla-ES-module app. Pure render functions in `lib/specialist.js` return HTML strings (unit-tested with `node --test`, asserting substrings — the repo pattern). Hand-authored fixtures live in `data/specialist.js` (same spirit as `data/decisions.js` / `data/monitor.js`). `app.js` gains two routes (`showSpecialist`, `showSpecialistCase`), a `specialist-mode` body class for full-viewport layout, and reuses the existing capture + policy-modal handlers. Policy links reuse `policyLink()`.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert`, static HTML/CSS. No build step, no dependencies.

## Global Constraints

- **Dark theme only**, reuse existing tokens from `sample/styles.css`: `--bg --col --col2 --line --tx --tx2 --tx3 --ok --warn --bad --info --mono`. Do **not** redefine `:root`.
- **Criticality is the primary card signal** (left border + tier chip): `Critical`→`c-crit` (red), `High`→`c-high` (amber), `Moderate`→`c-mod` (grey). Urgency is a **separate animated bar**. Colour is spent only on action — endline descriptors are grey until a breach turns red; blue is reserved for links + the status pill.
- **Terminal tier:** the case-view rail has **no "escalate"** action. A standing note states the decision is final and does not return to the operator.
- **Provenance verbiage (parallel, bold verb):** `automatically escalated` (agent-direct) vs `manually escalated` (operator), followed by the trigger + a `policies.md:NN` link.
- **Reuse, don't fork:** reuse `policyLink(n)` from `lib/render.js`; the existing `#drawerHost`-free full-view routing in `app.js`; the existing capture handler (`railCapture` on `.abtn[data-action="recommended"|"other"]`) and the global policy-modal handler.
- **Test command:** `cd sample && npm test` (alias for `node --test`). Focused: `node --test tests/specialist.test.js`.
- **Commit style:** conventional commits, one per task.

---

### Task 1: Cross-board retrofits — `Review → Claim` and `3 online`

Two small consistency changes to the already-shipped operator board so the product speaks one language (spec §7). Isolated and independently testable.

**Files:**
- Modify: `sample/lib/render.js` (the fallback button in `cardAction`, ~line 23; the team-backlog `exp` in `renderBoard`, ~line 82)
- Test: `sample/tests/render.test.js` (append)

**Interfaces:**
- Consumes: existing `renderCard`, `renderBoard`, `renderAgentSummary`.
- Produces: `renderCard` fallback second button now reads `Claim` (not `Review`); `renderBoard` team-backlog explanation now contains `3 online`.

- [ ] **Step 1: Write the failing tests** — append to `sample/tests/render.test.js`:

```js
test('card fallback pull button reads "Claim", not "Review"', () => {
  // a decision with no recommended action falls back to the pull button
  const vm = {
    display: { id: 'iss_x', typeLabel: 'Dispute', amountText: '$10.00', customerName: 'A', merchant: 'M', ageDays: 1, riskScore: 'low', isHighValue: false },
    decision: { urgency: { level: 'none', label: '⏱ no clock' }, why: { face: 'no_rule', lead: 'X' }, actions: { recommended: null } },
  };
  const html = renderCard(vm);
  assert.match(html, /data-action="open">Claim</);
  assert.doesNotMatch(html, />Review</);
});

test('team backlog header shows the 3-online presence indicator', () => {
  const html = renderBoard(
    { needs_review: [], in_review: [], on_hold: [], resolved: [] },
    { totals: { resolved: 0, waiting: 0, backlog: 0, escalated: 0 }, categories: [] },
  );
  assert.match(html, /3 online/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sample && node --test tests/render.test.js`
Expected: FAIL — button still says `Review`; no `3 online` string.

- [ ] **Step 3: Edit `sample/lib/render.js`**

In `cardAction`, change:
```js
  return '<button class="cbtn" data-action="open">Review</button>';
```
to:
```js
  return '<button class="cbtn" data-action="open">Claim</button>';
```

In `renderBoard`, change the team zone header line:
```js
      <div class="zhead"><span class="lbl">▤ Team backlog</span><span class="exp">Unassigned — anyone can pick these up.</span></div>
```
to:
```js
      <div class="zhead"><span class="lbl">▤ Team backlog</span><span class="exp">Unassigned — anyone can pick these up · <span class="online">3 online</span></span></div>
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && npm test`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add sample/lib/render.js sample/tests/render.test.js
git commit -m "feat(sample): retrofit operator board — Review→Claim + 3-online indicator"
```

---

### Task 2: Specialist data module

Hand-authored fixtures for the specialist board, mirroring `data/monitor.js`. Single source the render functions consume. `because`, `note`, `outcome` and history `val`s are trusted authored HTML (may contain `<b>`).

**Files:**
- Create: `sample/data/specialist.js`
- Test: `sample/tests/specialist.test.js` (create)

**Interfaces:**
- Produces: `export const SPECIALIST` with this exact shape:
  - `online: number`, `breakdown: string`
  - `queue: Card[]` (shared "Needs investigation")
  - `mine: { investigating: Card[], onhold: Card[], resolved: Card[] }`
  - `cases: { [id]: CaseDetail }`
  - `Card`: `{ id, type, amountText, meta, crit: 'crit'|'high'|'mod', tier: 'Critical'|'High'|'Moderate', highValue?: boolean, cat: 'fraud'|'dispute'|'retry'|'highvalue', bar: Bar|null, prov: Prov, breach?: boolean, owner?: 'you', outcome?: string }`
  - `Bar`: `{ fillPct: number, kind: 'act'|'reval'|'breach', word: string, limit: string, elapsed: string }`
  - `Prov`: `{ mode: 'auto'|'manual', reason: string, ref: number }`
  - `CaseDetail`: `{ id, txnId, type, amountText, tier, crit, status, bar: Bar, prov: { mode, by, because /*HTML*/, refs: number[] }, history: Node[], dataGap: { html, staged?: string }, context: { left: {title, rows: [k,v][]}, right: {title, rows: [k,v,('missing'|null)?][]} }, related: string, rail: { resolve: RailBtn[], other: RailBtn[] }, terminalNote: string }`
  - `Node`: `{ actor: string, actorClass: ''|'ag'|'ag fired'|'op'|'you', when?: string, ref?: number, st?: string, fired?: boolean, rows?: [pfx,val][], line?: string, note?: string, end?: boolean, endCrit?: 'high'|'crit', concl?: string }`
  - `RailBtn`: `{ label: string, sub: string, variant?: 'esc'|'go' }`

- [ ] **Step 1: Write the failing test** — create `sample/tests/specialist.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALIST } from '../data/specialist.js';

test('SPECIALIST queue cards carry criticality + provenance + a bar', () => {
  assert.ok(SPECIALIST.queue.length >= 4);
  for (const c of SPECIALIST.queue) {
    assert.ok(['crit', 'high', 'mod'].includes(c.crit));
    assert.ok(['auto', 'manual'].includes(c.prov.mode));
    assert.ok(typeof c.prov.ref === 'number');
    assert.ok(c.bar && typeof c.bar.fillPct === 'number');
  }
});

test('SPECIALIST resolved cards carry an outcome and no bar', () => {
  for (const c of SPECIALIST.mine.resolved) {
    assert.ok(typeof c.outcome === 'string' && c.outcome.length > 0);
    assert.equal(c.bar, null);
  }
});

test('every case detail referenced by a board card id exists for the demo two', () => {
  for (const id of ['iss_003', 'iss_099']) {
    assert.ok(SPECIALIST.cases[id], `case ${id} present`);
    assert.ok(SPECIALIST.cases[id].history.some((n) => n.end), `case ${id} has an end node`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: FAIL — `Cannot find module '../data/specialist.js'`.

- [ ] **Step 3: Create `sample/data/specialist.js`**

```js
// STATIC specialist fixtures. Hand-authored, same spirit as data/decisions.js.
// A future engine could compute criticality/urgency; the render layer only needs this shape.
// `because`, `note`, `outcome`, and history `val`s are trusted authored HTML (may contain <b>).
export const SPECIALIST = {
  online: 3,
  breakdown: '2 Critical · 2 High · 1 Moderate',

  queue: [
    { id: 'iss_087', type: 'Unauthorized charge', amountText: '$780.00', meta: 'iss_087 · R. Okoro · —— · 4h 12m',
      crit: 'crit', tier: 'Critical', cat: 'fraud', breach: true,
      bar: { fillPct: 100, kind: 'breach', word: 'act-by', limit: 'window spent — act now', elapsed: '' },
      prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    { id: 'iss_099', type: 'Unauthorized charge', amountText: '$412.00', meta: 'iss_099 · T. Nguyen · —— · 20m',
      crit: 'crit', tier: 'Critical', cat: 'fraud',
      bar: { fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' },
      prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    { id: 'iss_003', type: 'Dispute · not received', amountText: '$249.00', meta: 'iss_003 · M. Patel · FashionForward · 3h',
      crit: 'high', tier: 'High', cat: 'dispute',
      bar: { fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' },
      prov: { mode: 'manual', reason: 'over $200', ref: 53 } },
    { id: 'iss_071', type: 'Exhausted retries', amountText: '$89.99', meta: 'iss_071 · A. Chen · TechGadgets · 1d',
      crit: 'high', tier: 'High', cat: 'retry',
      bar: { fillPct: 30, kind: 'act', word: 'act-by', limit: '3rd retry failed', elapsed: 'in queue 1d' },
      prov: { mode: 'auto', reason: '3rd retry', ref: 16 } },
    { id: 'iss_066', type: 'Dispute · not received', amountText: '$1,204', meta: 'iss_066 · T. Kim · SubscriptionBox · 5h',
      crit: 'mod', tier: 'Moderate', cat: 'highvalue', highValue: true,
      bar: { fillPct: 52, kind: 'reval', word: 're-evaluate', limit: 'awaiting comms', elapsed: 'in queue 5h' },
      prov: { mode: 'manual', reason: 'spend > $2000', ref: 54 } },
  ],

  mine: {
    investigating: [
      { id: 'iss_054', type: 'Dispute · not received', amountText: '$318.00', meta: 'iss_054 · D. Rossi · GearHub · 6h',
        crit: 'high', tier: 'High', cat: 'dispute', owner: 'you',
        bar: { fillPct: 58, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 15', elapsed: 'in queue 6h' },
        prov: { mode: 'manual', reason: 'over $200', ref: 53 } },
    ],
    onhold: [
      { id: 'iss_048', type: 'Unauthorized charge', amountText: '$540.00', meta: 'iss_048 · P. Silva · —— · 1d 2h',
        crit: 'mod', tier: 'Moderate', cat: 'fraud', owner: 'you',
        bar: { fillPct: 44, kind: 'reval', word: 're-evaluate', limit: 'bank response due', elapsed: 'held' },
        prov: { mode: 'auto', reason: 'fraud always', ref: 63 } },
    ],
    resolved: [
      { id: 'iss_040', type: 'Unauthorized', amountText: '$960.00', meta: 'iss_040 · L. Haddad · closed 2h',
        crit: 'crit', tier: 'Critical', cat: 'fraud', owner: 'you', bar: null,
        prov: { mode: 'auto', reason: 'fraud always', ref: 63 },
        outcome: 'fraud confirmed · account blocked · charge reversed' },
      { id: 'iss_033', type: 'Dispute', amountText: '$212.00', meta: 'iss_033 · N. Abara · closed 4h',
        crit: 'high', tier: 'High', cat: 'dispute', owner: 'you', bar: null,
        prov: { mode: 'manual', reason: 'over $200', ref: 53 },
        outcome: 'dispute denied · delivery confirmed' },
    ],
  },

  cases: {
    iss_003: {
      id: 'iss_003', txnId: 'txn_6103', type: 'Dispute · item not received', amountText: '$249.00',
      tier: 'High', crit: 'high', status: 'Investigating · yours',
      bar: { fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' },
      prov: { mode: 'manual', by: 'operator', because: '<b>Alex Chen</b> reviewed this and escalated it — the dispute amount <b>$249 exceeds the $200 trigger</b>, which a standard operator can\'t clear. It landed in your queue, not resolved.', refs: [53] },
      history: [
        { actor: 'System', actorClass: '', when: 'Jan 13 · 08:15', line: 'Ticket created from txn_6103 — dispute, "item not received."' },
        { actor: 'Agent', actorClass: 'ag', ref: 51, st: 'rule not met', rows: [['RULE', 'Auto-resolve if tracking shows "delivered" + 3 days.'], ['EVIDENCE', 'Parcel is in transit → cannot auto-resolve.']] },
        { actor: 'Agent', actorClass: 'ag fired', ref: 53, st: 'rule fired', fired: true, rows: [['RULE', 'Escalate if dispute amount &gt; $200.'], ['EVIDENCE', '$249 &gt; $200 → recommend escalate to specialist.']] },
        { actor: 'Operator · Alex', actorClass: 'op', when: 'Jan 13 · 11:02', line: 'Claimed, confirmed the $200 trigger, escalated to the specialist board.', note: '"Customer says the parcel\'s been stuck in transit 5 days and wants a refund now. Tracking hasn\'t updated since Chicago."' },
        { actor: 'You · Sam', actorClass: 'you', end: true, endCrit: 'high', concl: 'Your terminal decision — refund, deny, or hold for the carrier scan.' },
      ],
      dataGap: { html: 'Policy REF55 / REF56 want <b>merchant fulfilment history, delivery-confirmation events, and customer comms history</b> to decide this. <b>None exist in the dataset</b> — merchant is a bare string. You\'re adjudicating on <b>amount + live tracking status</b> alone. The verdict is defensible, but the policy references evidence we don\'t capture.' },
      context: {
        left: { title: 'Customer', rows: [['Name', 'Morgan Patel'], ['Lifetime spend', '$312.00 · 2 transactions'], ['Disputes filed / won', '0 / 0'], ['Risk score', 'low']] },
        right: { title: 'Shipping', rows: [['Merchant', 'FashionForward'], ['Carrier / status', 'UPS · in transit'], ['Tracking', '1Z999AA10123456784'], ['Last update', 'Jan 12 · Chicago IL']] },
      },
      related: 'No other open tickets for this customer.',
      rail: {
        resolve: [
          { label: 'Refund customer $249', sub: 'reverse the charge · notify customer', variant: 'go' },
          { label: 'Deny dispute', sub: 'tracking active · no evidence of loss yet' },
        ],
        other: [{ label: 'Put on hold', sub: '⟳ await carrier scan · re-evaluate Jan 14' }],
      },
      terminalNote: 'This is the top of the ladder — there is no "escalate" from here. The decision is final and does not return to the operator.',
    },

    iss_099: {
      id: 'iss_099', txnId: 'txn_7740', type: 'Unauthorized charge', amountText: '$412.00',
      tier: 'Critical', crit: 'crit', status: 'Investigating · yours',
      bar: { fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' },
      prov: { mode: 'auto', by: 'agent', because: 'No human touched this. The agent auto-escalated it the instant it arrived — unauthorized-charge claims <b>always go straight to a specialist</b> and <b>can never be auto-resolved</b>. It <b>skipped the operator board entirely</b>.', refs: [63, 64] },
      history: [
        { actor: 'System', actorClass: '', when: 'Jan 13 · 09:40', line: 'Customer reported charge txn_7740 as "I didn\'t make this purchase."' },
        { actor: 'Agent', actorClass: 'ag', ref: 63, st: 'constraint', rows: [['RULE', 'Fraud claims — auto-resolve: <b>never</b>.'], ['EVIDENCE', 'Automation is forbidden from closing this. Human required.']] },
        { actor: 'Agent', actorClass: 'ag fired', ref: 64, st: 'rule fired', fired: true, rows: [['RULE', 'Unauthorized transaction — escalate <b>always, immediately</b>. Priority: high.'], ['EVIDENCE', 'Escalated to specialist on arrival, no operator step.']] },
        { actor: 'You · Sam', actorClass: 'you', end: true, endCrit: 'crit', concl: 'Your terminal decision — confirm fraud, clear the charge, or verify with the customer.' },
      ],
      dataGap: {
        html: 'Policy REF66 says adjudicating fraud needs <b>device fingerprint, IP address, and purchase patterns</b>. <b>None of them exist in the dataset.</b> You\'re asked to <b>confirm or clear fraud with zero fraud signals</b> — the only evidence is the customer\'s claim, the amount, and thin account history.',
        staged: '⚑ Staged case — no unauthorized-transaction ticket exists in the five fixtures; synthesised here to exercise the fraud path the policy demands but the data can\'t feed.',
      },
      context: {
        left: { title: 'Customer', rows: [['Name', 'T. Nguyen'], ['Account age', '3 weeks (new)'], ['Lifetime spend', '$980 · 3 transactions'], ['Disputes filed / won', '1 / 0'], ['Risk score', 'medium']] },
        right: { title: 'The charge', rows: [['Amount', '$412.00'], ['Payment method', 'card_visa_9981'], ['Device fingerprint', '— not captured (:66)', 'missing'], ['IP address', '— not captured (:66)', 'missing'], ['Purchase patterns', '— not available (:66)', 'missing']] },
      },
      related: '1 prior dispute filed by this customer (lost). No other open tickets.',
      rail: {
        resolve: [
          { label: 'Confirm fraud', sub: 'block account · reverse charge · flag device', variant: 'esc' },
          { label: 'Clear — legitimate charge', sub: 'dismiss claim · keep the charge' },
        ],
        other: [{ label: 'Contact customer to verify', sub: '⟳ await identity confirmation · on hold' }],
      },
      terminalNote: 'Top of the ladder — no "escalate" from here. Final, and does not return to the operator.',
    },
  },
};
```

> Note: the `dataGap.html` strings use `REF55`/`REF56`/`REF66` as placeholders that Task 4 replaces with real `policyLink()` calls at render time (so the numbers become clickable). They are authored this way to keep the fixture free of markup for line numbers.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add sample/data/specialist.js sample/tests/specialist.test.js
git commit -m "feat(sample): specialist fixtures — queue, my-work lanes, two case details"
```

---

### Task 3: Specialist render — board (toolbar, zones, card, urgency bar)

**Files:**
- Create: `sample/lib/specialist.js`
- Test: `sample/tests/specialist.test.js` (append)

**Interfaces:**
- Consumes: `policyLink` from `./render.js`; `SPECIALIST`.
- Produces:
  - `renderUrgencyBar(bar, crit='high') -> string` (`.ubar` with `.ufil.<crit|high|mod|full>` — fill colour from `crit`, `full` on breach; elapsed label, `.uend` with icon+word+limit; breach when `bar.kind==='breach'`)
  - `renderSpecialistCard(card, opts) -> string` — root `.tk.c-<crit>[.breach]` `data-case="<id>"`; tier chip, optional `high-value` tag, urgency bar (unless resolved), provenance line, actions. `opts.claimed` → owner tag + single `Open ticket`; `opts.resolved` → outcome line + single `Open ticket`; otherwise `Open ticket` + `Claim`.
  - `renderSpecialistToolbar() -> string` — sort control + filter chips (`.chip[data-cat][data-action="sb-chip"]`, first `.on`) + search (`#sbq[data-action="sb-search"]`)
  - `renderSpecialistBoard(s) -> string` — toolbar + `.boardarea > .twozone`: shared `Needs investigation` column (cards wrapped in `#sb-queue.cards`) + private `My work` lanes (Investigating / On hold / Resolved).

- [ ] **Step 1: Write the failing test** — append to `sample/tests/specialist.test.js`:

```js
import { renderUrgencyBar, renderSpecialistCard, renderSpecialistToolbar, renderSpecialistBoard } from '../lib/specialist.js';

test('renderUrgencyBar shows elapsed, act-by/re-evaluate word, and breach state', () => {
  const act = renderUrgencyBar({ fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' });
  assert.match(act, /in queue 20m/);
  assert.match(act, /act-by/);
  assert.match(act, /⚠/);
  const breach = renderUrgencyBar({ fillPct: 100, kind: 'breach', word: 'act-by', limit: 'window spent — act now', elapsed: '' });
  assert.match(breach, /uend breach/);
  const reval = renderUrgencyBar({ fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' });
  assert.match(reval, /⟳/);
});

test('renderSpecialistCard: shared card has criticality border, provenance, Claim', () => {
  const html = renderSpecialistCard(SPECIALIST.queue[2], {}); // iss_003 High manual
  assert.match(html, /class="tk c-high"[^>]*data-case="iss_003"/);
  assert.match(html, /class="crt high">High</);
  assert.match(html, /<b>manually escalated<\/b>/);
  assert.match(html, /data-line="53"/);
  assert.match(html, /data-action="open-case" data-id="iss_003"/);
  assert.match(html, /data-action="claim" data-id="iss_003"/);
});

test('renderSpecialistCard: breach card pulses + bumps; auto card reads "automatically escalated"', () => {
  const html = renderSpecialistCard(SPECIALIST.queue[0], {}); // iss_087 breach auto
  assert.match(html, /class="tk c-crit breach"/);
  assert.match(html, /⤒ bumped to top/);
  assert.match(html, /<b>automatically escalated<\/b>/);
});

test('renderSpecialistCard: resolved card shows outcome + no bar + no Claim', () => {
  const html = renderSpecialistCard(SPECIALIST.mine.resolved[0], { resolved: true });
  assert.match(html, /class="outcome"/);
  assert.match(html, /fraud confirmed/);
  assert.doesNotMatch(html, /class="ubar"/);
  assert.doesNotMatch(html, /data-action="claim"/);
});

test('renderSpecialistBoard: two zones, grounded chips, scroll container, my-work lanes', () => {
  const html = renderSpecialistBoard(SPECIALIST);
  assert.match(html, /Escalation queue/);
  assert.match(html, /Needs investigation/);
  assert.match(html, /id="sb-queue"/);
  assert.match(html, /data-cat="fraud"/);       // grounded filter chip
  assert.match(html, /Investigating/);
  assert.match(html, /On hold/);
  assert.match(html, /3 online/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: FAIL — `lib/specialist.js` has no such exports.

- [ ] **Step 3: Create `sample/lib/specialist.js`**

```js
import { policyLink } from './render.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BAR_ICON = { act: '⚠', breach: '⚠', reval: '⟳' };

export function renderUrgencyBar(bar, crit = 'high') {
  if (!bar) return '';
  const isBreach = bar.kind === 'breach';
  // fill colour follows the card's criticality tier (crit→red, high→amber, mod→grey); breach fills solid red
  const fill = isBreach ? 'ufil full' : `ufil ${crit}`;
  const elapsed = bar.elapsed ? `<span class="uel">${esc(bar.elapsed)}</span>` : '';
  const endClass = isBreach ? 'uend breach' : 'uend';
  const width = isBreach ? '100%' : `${bar.fillPct}%`;
  return `<div class="ubar"><div class="utrk"><div class="${fill}" style="width:${width}">${elapsed}<span class="uedge"></span></div></div>
    <div class="${endClass}"><span class="mk">${BAR_ICON[bar.kind]}</span><span class="wd">${esc(bar.word)}</span><span>· ${esc(bar.limit)}</span></div></div>`;
}

function provLine(prov) {
  const verb = prov.mode === 'auto' ? 'automatically escalated' : 'manually escalated';
  const who = prov.mode === 'auto' ? 'by agent' : 'by operator';
  return `<div class="prov">↑ <b>${verb}</b> ${who} · ${esc(prov.reason)} · ${policyLink(prov.ref)}</div>`;
}

export function renderSpecialistCard(c, opts = {}) {
  const breach = c.breach ? ' breach' : '';
  const bump = c.breach ? '<span class="bump">⤒ bumped to top</span>' : '';
  const hv = c.highValue ? '<span class="rtag hv">high-value</span>' : '';
  const owner = c.owner ? `<span class="own">${opts.resolved ? '✓' : '🔒'} you</span>` : '';
  const tags = `<div class="tags"><span class="crt ${c.crit}">${esc(c.tier)}</span>${hv}${owner}</div>`;
  const mid = opts.resolved
    ? `<div class="outcome">${c.outcome}</div>`
    : renderUrgencyBar(c.bar, c.crit);
  const prov = opts.resolved ? '' : provLine(c.prov);
  const acts = opts.claimed || opts.resolved
    ? `<div class="cardacts"><button class="cbtn" data-action="open-case" data-id="${esc(c.id)}">Open ticket</button></div>`
    : `<div class="cardacts"><button class="cbtn" data-action="open-case" data-id="${esc(c.id)}">Open ticket</button><button class="cbtn claim" data-action="claim" data-id="${esc(c.id)}">Claim</button></div>`;
  return `<div class="tk c-${c.crit}${breach}" data-case="${esc(c.id)}">${bump}
    <div class="t1"><b>${esc(c.type)}</b><span class="amt">${esc(c.amountText)}</span></div>
    <div class="t2">${esc(c.meta)}</div>
    ${tags}
    ${mid}
    ${opts.resolved ? '' : prov}
    ${acts}
  </div>`;
}

const CHIPS = [
  { cat: 'all', label: 'All' },
  { cat: 'fraud', label: 'Fraud' },
  { cat: 'dispute', label: 'Disputes > $200' },
  { cat: 'retry', label: 'Exhausted retries' },
  { cat: 'highvalue', label: 'High-value' },
];

export function renderSpecialistToolbar() {
  const chips = CHIPS.map((c, i) =>
    `<span class="chip ${i === 0 ? 'on' : ''}" data-cat="${c.cat}" data-action="sb-chip">${esc(c.label)}</span>`).join('');
  return `<div class="sbtools">
    <span class="tlbl">Sort</span><span class="sortsel">Criticality → Urgency ▾</span>
    <div class="chips">${chips}</div>
    <input class="search sbsearch" id="sbq" placeholder="🔎 id / customer / merchant" data-action="sb-search">
  </div>`;
}

function laneCards(cards, opts) {
  return cards.length ? cards.map((c) => renderSpecialistCard(c, opts)).join('')
    : '<div class="empty">Nothing here</div>';
}

export function renderSpecialistBoard(s) {
  const queue = s.queue.map((c) => renderSpecialistCard(c, {})).join('');
  return `${renderSpecialistToolbar()}
  <div class="boardarea">
    <div class="twozone">
      <div class="zone team">
        <div class="zhead"><span class="lbl">Escalation queue</span><span class="exp">Unassigned — any specialist can claim these · <span class="online">${s.online} online</span></span></div>
        <div class="col shared sbcol">
          <div class="col-h"><h4>Needs investigation</h4><span class="n">${s.queue.length}</span></div>
          <p class="col-note">${esc(s.breakdown)} — claim one to lock it to you &amp; leave others' view.</p>
          <div class="cards" id="sb-queue">${queue}</div>
        </div>
      </div>
      <div class="zone mine">
        <div class="zhead"><span class="lbl">◧ My work</span><span class="exp">Cases you claimed (Sam) — only you see &amp; act on these.</span></div>
        <div class="lanes">
          <div class="col sbcol">
            <div class="col-h"><h4>Investigating</h4><span class="n">${s.mine.investigating.length}</span></div>
            <p class="col-note">Actively working now.</p>
            <div class="cards" id="sb-investigating">${laneCards(s.mine.investigating, { claimed: true })}</div>
          </div>
          <div class="col sbcol">
            <div class="col-h"><h4>On hold</h4><span class="n">${s.mine.onhold.length}</span></div>
            <p class="col-note">Awaiting an external party (bank / carrier / customer).</p>
            <div class="cards" id="sb-onhold">${laneCards(s.mine.onhold, { claimed: true })}</div>
          </div>
          <div class="col sbcol">
            <div class="col-h"><h4>Resolved</h4><span class="n">${s.mine.resolved.length}</span></div>
            <p class="col-note">Closed by you — terminal.</p>
            <div class="cards" id="sb-resolved">${laneCards(s.mine.resolved, { resolved: true })}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/specialist.js sample/tests/specialist.test.js
git commit -m "feat(sample): specialist board render — toolbar, zones, card, urgency bar"
```

---

### Task 4: Specialist render — case view

The full 60/40 case view: header (with urgency bar), provenance banner, stacked actor-tagged case history, data gap, context tables, terminal decision rail.

**Files:**
- Modify: `sample/lib/specialist.js` (append)
- Test: `sample/tests/specialist.test.js` (append)

**Interfaces:**
- Consumes: `policyLink`, `SPECIALIST.cases`.
- Produces:
  - `renderCaseHistory(nodes) -> string` (`.tl` with `.step[.f]`, actor badge `.actor.<class>`, RULE/EVIDENCE rows or a single line, optional `.note`, and an `.step.end.<crit>` node)
  - `renderCaseView(caseDetail) -> string` — `.topbar` (back hook `data-action="sb-back"`), `.grid` 60/40 (`.main` + `.rail`), the data gap with `policyLink`-resolved refs, and a terminal rail whose buttons use `data-action="recommended"|"other"` (so the existing capture handler fires). No "escalate" action.

- [ ] **Step 1: Write the failing test** — append to `sample/tests/specialist.test.js`:

```js
import { renderCaseHistory, renderCaseView } from '../lib/specialist.js';

test('renderCaseHistory: agent badge grey by default, red when fired, end node inherits criticality', () => {
  const html = renderCaseHistory(SPECIALIST.cases.iss_003.history);
  assert.match(html, /class="actor ag">Agent/);        // not-fired agent, plain grey
  assert.match(html, /class="actor ag fired">Agent/);  // fired agent
  assert.match(html, /class="step end high"/);         // High case → amber end node
  assert.match(html, /Operator · Alex/);
  assert.match(html, /stuck in transit 5 days/);       // the operator note
});

test('renderCaseView (dispute): stacked history, terminal rail, no escalate, data-gap links resolved', () => {
  const html = renderCaseView(SPECIALIST.cases.iss_003);
  assert.match(html, /data-action="sb-back"/);
  assert.match(html, /MANUALLY ESCALATED BY OPERATOR/i);
  assert.match(html, /class="grid"/);
  assert.match(html, /Refund customer \$249/);
  assert.match(html, /data-action="recommended"/);     // reuses existing capture handler
  assert.doesNotMatch(html, /escalate/i);              // terminal tier — no escalate action
  assert.match(html, /data-line="55"/);                // REF55 resolved to a real policy link
  assert.match(html, /does not return to the operator/);
});

test('renderCaseView (fraud): critical end node, staged note, missing-data rows', () => {
  const html = renderCaseView(SPECIALIST.cases.iss_099);
  assert.match(html, /class="step end crit"/);
  assert.match(html, /Staged case/);
  assert.match(html, /class="v missing">— not captured/);
  assert.match(html, /Confirm fraud/);
  assert.match(html, /data-line="66"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: FAIL — `renderCaseHistory`/`renderCaseView` not exported.

- [ ] **Step 3: Append to `sample/lib/specialist.js`**

```js
// resolve REF<nn> placeholders in trusted authored HTML into real policy links
const resolveRefs = (html) => String(html).replace(/REF(\d+)/g, (_, n) => policyLink(Number(n)));

export function renderCaseHistory(nodes) {
  const steps = nodes.map((n) => {
    if (n.end) {
      return `<div class="step end ${n.endCrit}"><div class="dot"></div>
        <div class="shead"><span class="actor you">${esc(n.actor)}</span></div>
        <div class="concl">${esc(n.concl)}</div></div>`;
    }
    const badge = `<span class="actor ${n.actorClass}">${esc(n.actor)}</span>`;
    const meta = n.ref
      ? `${badge}${policyLink(n.ref)}<span class="st">${esc(n.st)}</span>`
      : `${badge}<span class="st">${esc(n.when || '')}</span>`;
    const body = n.rows
      ? n.rows.map(([p, v]) => `<div class="ln"><span class="pfx">${esc(p)}</span><span class="val">${v}</span></div>`).join('')
      : `<div class="ln"><span class="val">${esc(n.line)}</span></div>`;
    const note = n.note ? `<div class="note">${esc(n.note)}</div>` : '';
    return `<div class="step ${n.fired ? 'f' : ''}"><div class="dot"></div>
      <div class="shead">${meta}</div>${body}${note}</div>`;
  }).join('');
  return `<div class="tl">${steps}</div>`;
}

function railBtn(b) {
  const cls = b.variant === 'esc' ? 'abtn rec-esc' : b.variant === 'go' ? 'abtn rec-go' : 'abtn';
  const action = b.variant ? 'recommended' : 'other';
  return `<button class="${cls}" data-action="${action}">${esc(b.label)}<span class="sub">${esc(b.sub)}</span></button>`;
}

function ctxTable(t) {
  const rows = t.rows.map((r) => {
    const [k, v, missing] = r;
    return `<tr><td class="k">${esc(k)}</td><td class="v${missing ? ' missing' : ''}">${esc(v)}</td></tr>`;
  }).join('');
  return `<div><div class="grp">${esc(t.title)}</div><table class="ctable">${rows}</table></div>`;
}

export function renderCaseView(c) {
  const provLead = c.prov.mode === 'auto' ? '↑ AUTOMATICALLY ESCALATED BY AGENT' : '↑ MANUALLY ESCALATED BY OPERATOR';
  const staged = c.dataGap.staged ? `<div class="staged">${esc(c.dataGap.staged)}</div>` : '';
  const resolve = c.rail.resolve.map(railBtn).join('');
  const other = c.rail.other.map(railBtn).join('');
  return `<div class="topbar"><a class="back" data-action="sb-back">← Board</a>
      <span class="path">Specialist board / <b>${esc(c.id)} · ${esc(c.type)}</b></span></div>
  <div class="grid">
    <div class="main">
      <div class="thead">
        <div class="l1"><span class="ids">${esc(c.id)} · ${esc(c.txnId)}</span><span class="statuspill">${esc(c.status)}</span></div>
        <div class="l2"><span class="type">${esc(c.type)}</span><span class="amt">${esc(c.amountText)}</span></div>
        <div class="l1"><span class="crt ${c.crit}">${esc(c.tier)}</span></div>
        ${renderUrgencyBar(c.bar, c.crit)}
      </div>
      <div class="prov-b"><div class="lead">${esc(provLead)}</div><div class="bc">${resolveRefs(c.prov.because)}</div></div>
      <div><h4 class="sh">Case history — agent → ${c.prov.mode === 'auto' ? 'you' : 'operator → you'}</h4>${renderCaseHistory(c.history)}</div>
      <div class="datagap"><div class="t">⚠ DATA GAP</div><div class="b">${resolveRefs(c.dataGap.html)}</div>${staged}</div>
      <hr class="rule">
      <div><h4 class="sh">Context</h4><div class="ctxwrap">${ctxTable(c.context.left)}${ctxTable(c.context.right)}</div></div>
      <hr class="rule">
      <div><h4 class="sh">Related</h4><div class="rel">${esc(c.related)}</div></div>
    </div>
    <div class="rail">
      <div class="dpanel"><div class="h">Terminal decision</div><div class="body">
        <div class="grp">Resolve</div>
        ${resolve}
        <div class="grp second">Other moves</div>
        ${other}
        <div class="logged"><b>Writes to the audit log:</b> who (Sam), when, action, reason, policy version. Every terminal action captures a reason before it commits (${policyLink(90)}).</div>
      </div></div>
      <div class="terminal-note">${esc(c.terminalNote)}</div>
    </div>
  </div>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd sample && node --test tests/specialist.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sample/lib/specialist.js sample/tests/specialist.test.js
git commit -m "feat(sample): specialist case view — stacked history + terminal rail + data gap"
```

---

### Task 5: Wire the specialist board into `app.js`

Replace the "coming soon" toast with real routing, add the `specialist-mode` body class (full-viewport layout), and wire claim/open/back/chip/search interactions. The terminal-rail capture and policy modal already work via existing handlers.

**Files:**
- Modify: `sample/app.js`

**Interfaces:**
- Consumes: `renderSpecialistBoard`, `renderCaseView` from `./lib/specialist.js`; `SPECIALIST` from `./data/specialist.js`.
- Produces: `showSpecialist()`, `showSpecialistCase(id)`; body carries class `specialist-mode` only on those two views.

- [ ] **Step 1: Add imports** — in `sample/app.js`, extend the specialist import area. Change:

```js
import { renderPipelineNav } from './lib/nav.js';
import { MONITOR } from './data/monitor.js';
```
to:
```js
import { renderPipelineNav } from './lib/nav.js';
import { MONITOR } from './data/monitor.js';
import { renderSpecialistBoard, renderCaseView } from './lib/specialist.js';
import { SPECIALIST } from './data/specialist.js';
```

- [ ] **Step 2: Add the two show functions + mode helper** — after `showDrill()` (~line 46), add:

```js
function setSpecialistMode(on) {
  document.body.classList.toggle('specialist-mode', on);
}
function showSpecialist() {
  setSpecialistMode(true);
  app.innerHTML = renderSpecialistBoard(SPECIALIST) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}
function showSpecialistCase(id) {
  const c = SPECIALIST.cases[id];
  if (!c) { toast(`${id} — case view is demoed on iss_003 & iss_099`); return; }
  setSpecialistMode(true);
  app.innerHTML = renderCaseView(c) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}
```

- [ ] **Step 3: Clear specialist-mode when leaving** — add `setSpecialistMode(false);` as the first line inside `showBoard`, `showMonitor`, `showDrill`, and `showDetail`. For example `showBoard` becomes:

```js
function showBoard() {
  setSpecialistMode(false);
  app.innerHTML = renderBoard(groupByColumn(VIEW_MODELS), AGENT_SUMMARY) + renderPipelineNav('operator');
  window.scrollTo(0, 0);
}
```
Do the same (first line `setSpecialistMode(false);`) in `showMonitor`, `showDrill`, `showDetail`.

- [ ] **Step 4: Route the nav pill + card actions** — in the pipeline-nav click handler, change:

```js
    if (view === 'agent') showMonitor();
    else if (view === 'operator') showBoard();
    else toast('Specialist board — coming soon');
```
to:
```js
    if (view === 'agent') showMonitor();
    else if (view === 'operator') showBoard();
    else showSpecialist();
```

Then, in the same delegated `app.addEventListener('click', …)` block that handles drill/drawers (the one starting `// drill navigation`), add these handlers (place them right after the `// pipeline nav` block's `return`):

```js
  // specialist board
  const openCase = e.target.closest('[data-action="open-case"]');
  if (openCase) { showSpecialistCase(openCase.getAttribute('data-id')); return; }
  if (e.target.closest('[data-action="sb-back"]')) { showSpecialist(); return; }
  const claimBtn = e.target.closest('[data-action="claim"]');
  if (claimBtn) { claimCase(claimBtn.getAttribute('data-id')); return; }
  const sbChip = e.target.closest('.chip[data-action="sb-chip"]');
  if (sbChip) {
    sbChip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
    sbChip.classList.add('on');
    applySpecialistFilter();
    return;
  }
```

- [ ] **Step 5: Add claim + filter helpers** — near the drill filter helpers (after `applyDrillFilter`), add:

```js
function claimCase(id) {
  const card = document.querySelector(`#sb-queue [data-case="${id}"]`);
  const lane = document.getElementById('sb-investigating');
  if (!card || !lane) return;
  card.remove();
  const c = SPECIALIST.queue.find((x) => x.id === id);
  if (c) { const el = document.createElement('div'); el.innerHTML = renderSpecialistCardClaimed(c); lane.insertAdjacentElement('afterbegin', el.firstElementChild); }
  // update counts
  const qn = document.querySelector('#sb-queue')?.children.length ?? 0;
  const invN = document.querySelector('#sb-investigating')?.children.length ?? 0;
  const qHead = document.querySelector('.zone.team .col-h .n');
  const invHead = document.querySelectorAll('.zone.mine .col-h .n')[0];
  if (qHead) qHead.textContent = String(qn);
  if (invHead) invHead.textContent = String(invN);
  toast(`${id} claimed — locked to you`);
}
function applySpecialistFilter() {
  const chip = document.querySelector('.chip.on[data-cat]');
  const cat = chip ? chip.getAttribute('data-cat') : 'all';
  const q = (document.getElementById('sbq')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#sb-queue > .tk').forEach((tk) => {
    const c = SPECIALIST.queue.find((x) => x.id === tk.getAttribute('data-case'));
    const okCat = cat === 'all' || (c && c.cat === cat);
    const okQ = !q || (c && (c.id + ' ' + c.meta).toLowerCase().includes(q));
    tk.style.display = okCat && okQ ? '' : 'none';
  });
}
```

- [ ] **Step 6: Import the claimed-card helper** — `claimCase` above calls `renderSpecialistCardClaimed`. Add it to the specialist import in `app.js` and export a thin wrapper from `lib/specialist.js`. In `lib/specialist.js` append:

```js
export const renderSpecialistCardClaimed = (c) => renderSpecialistCard(c, { claimed: true });
```
And extend the app.js import:
```js
import { renderSpecialistBoard, renderCaseView, renderSpecialistCardClaimed } from './lib/specialist.js';
```

- [ ] **Step 7: Wire the specialist search input** — the existing `app.addEventListener('input', …)` handles drill search; extend it. Change:

```js
app.addEventListener('input', (e) => {
  if (e.target.closest('[data-action="drill-search"]')) applyDrillFilter();
});
```
to:
```js
app.addEventListener('input', (e) => {
  if (e.target.closest('[data-action="drill-search"]')) applyDrillFilter();
  if (e.target.closest('[data-action="sb-search"]')) applySpecialistFilter();
});
```

- [ ] **Step 8: Run the existing test suite (must stay green)**

Run: `cd sample && npm test`
Expected: PASS (no test touches `app.js`; this confirms nothing else broke).

- [ ] **Step 9: Manual verification**

Run: `cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`, click the **🔎 Specialist board** pill. Confirm: the board fills the viewport; the **Needs investigation** column scrolls on its own while the page does not; a filter chip narrows the queue; `Claim` moves a card into **Investigating** and updates both counts; `Open ticket` on `iss_003`/`iss_099` opens the case view; `← Board` returns; a terminal-rail button opens the capture with a `Confirm`; a `policies.md:NN` link opens the policy dialog; leaving to another pill restores normal-flow layout.

- [ ] **Step 10: Commit**

```bash
git add sample/app.js sample/lib/specialist.js
git commit -m "feat(sample): route specialist board + case view, claim/filter interactions"
```

---

### Task 6: Styles — append specialist CSS

Append the specialist styles to `sample/styles.css`. Source of truth: the approved mockups `.superpowers/brainstorm/677503-*/content/board-fullscreen-v4.html` and `case-view-fraud-v1.html` (read their `<style>` blocks). The block below is the consolidated, deduplicated CSS to add — paste it verbatim at the end of `styles.css`. Tokens and the base `.tk/.twozone/.zone/.col/.col-note/.pnav/.chip/.abtn/.abtn.rec-esc/.abtn.rec-go/.capture/.grid/.statuspill/.datagap/.ctable/.dpanel/.logged` classes already exist — do **not** redefine them; this only adds specialist-specific classes and `specialist-mode` overrides.

**Files:**
- Modify: `sample/styles.css` (append)

- [ ] **Step 1: Append this CSS to `sample/styles.css`**

```css
/* ================= specialist board ================= */
/* full-viewport shell — only while the specialist board/case view is mounted */
body.specialist-mode{overflow:hidden}
body.specialist-mode #app.wrap{max-width:none;margin:0;padding:0;height:100vh;display:flex;flex-direction:column}
.online{color:var(--ok)}

/* toolbar */
.sbtools{flex:none;display:flex;align-items:center;gap:10px;padding:12px 18px;flex-wrap:wrap}
.sbtools .tlbl{font:9.5px var(--mono);letter-spacing:.4px;text-transform:uppercase;color:var(--tx3)}
.sbtools .sortsel{font:600 11px var(--mono);padding:7px 12px;border-radius:8px;border:1px solid var(--line);background:var(--col2);color:var(--tx2)}
.sbtools .sbsearch{margin-left:auto;flex:0 0 auto;min-width:190px}

/* full-height board + per-column scroll */
.boardarea{flex:1;min-height:0;padding:0 18px 78px}
body.specialist-mode .twozone{height:100%}
body.specialist-mode .zone{display:flex;flex-direction:column;min-height:0}
body.specialist-mode .zone.team .col.sbcol{flex:1}
body.specialist-mode .lanes{flex:1;min-height:0}
.col.sbcol{display:flex;flex-direction:column;min-height:0}
.col.sbcol .cards{flex:1;min-height:0;overflow-y:auto;padding:10px 5px 0 2px}
.col.sbcol .cards::-webkit-scrollbar{width:8px}
.col.sbcol .cards::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}

/* criticality border + tier chip + breach pulse */
.tk.c-crit{border-left-color:var(--bad)} .tk.c-high{border-left-color:var(--warn)} .tk.c-mod{border-left-color:var(--tx3)}
.tk.breach{animation:pulseRed 1.8s ease-in-out infinite}
.tk .bump{position:absolute;top:-8px;left:10px;font:9px var(--mono);background:var(--bad);color:#0d1117;font-weight:700;padding:1px 6px;border-radius:4px}
.tk{position:relative}
.crt{font:10px var(--mono);letter-spacing:.4px;text-transform:uppercase;font-weight:700;border-radius:5px;padding:1px 6px}
.crt.crit{color:var(--bad);border:1px solid rgba(248,81,73,.4)} .crt.high{color:var(--warn);border:1px solid rgba(210,153,34,.4)} .crt.mod{color:var(--tx2);border:1px solid var(--line)}
.own{margin-left:auto;font:10px var(--mono);color:var(--ok)}
.prov{font:11px var(--mono);color:var(--tx3);margin-top:9px;padding-top:8px;border-top:1px solid var(--line);line-height:1.4}
.prov b{color:var(--tx)}
.outcome{font:11px var(--mono);color:var(--ok);margin-top:9px;padding-top:8px;border-top:1px solid var(--line);font-weight:600}
.cbtn.claim{border-color:rgba(88,166,255,.5);color:var(--info);background:rgba(88,166,255,.08)}

/* urgency bar */
.ubar{position:relative;margin:17px 1px 2px;max-width:360px}
.utrk{height:6px;border-radius:3px;background:var(--line);position:relative;overflow:hidden}
.ufil{height:100%;border-radius:3px;position:relative;overflow:hidden}
.ufil.crit{background:var(--bad);box-shadow:0 0 6px rgba(248,81,73,.5)} .ufil.high{background:var(--warn)} .ufil.mod{background:var(--tx3)} .ufil.full{background:var(--bad);width:100%;box-shadow:0 0 6px rgba(248,81,73,.5)}
.ufil::after{content:"";position:absolute;top:0;left:0;height:100%;width:55%;z-index:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4) 50%,transparent);transform:translateX(-160%);animation:shine 2.3s linear infinite}
@keyframes shine{to{transform:translateX(360%)}}
.uedge{position:absolute;right:0;top:-3px;bottom:-3px;width:2px;background:var(--tx);opacity:.85;z-index:2}
.uel{position:absolute;right:0;top:-15px;transform:translateX(50%);white-space:nowrap;font:9px var(--mono);color:var(--tx2);z-index:2}
.uend{display:flex;align-items:center;gap:5px;margin-top:9px;font:11px var(--mono);color:var(--tx3)}
.uend .mk{font-size:13px} .uend .wd{font-weight:700;color:var(--tx2)}
.uend.breach,.uend.breach .wd{color:var(--bad)}

/* case view: full-height 60/40, provenance banner, actor timeline, staged/missing */
body.specialist-mode .grid{flex:1;min-height:0}
body.specialist-mode .main{overflow-y:auto;min-height:0;padding-bottom:90px}
body.specialist-mode .rail{overflow-y:auto;min-height:0;padding-bottom:90px}
.main h4.sh{font-size:15px;font-weight:600;color:var(--tx);margin:0 0 12px;letter-spacing:-.01em}
.prov-b{border:1px solid var(--line);background:rgba(139,151,168,.06);border-radius:10px;padding:13px 15px;margin:2px 0}
.prov-b .lead{font:700 13px var(--mono);color:var(--tx2);letter-spacing:.2px}
.prov-b .bc{color:var(--tx2);font-size:13px;margin-top:7px;line-height:1.55} .prov-b .bc b{color:var(--tx)}
.tl .actor{font:9px var(--mono);letter-spacing:.5px;text-transform:uppercase;font-weight:700;padding:1px 6px;border-radius:4px;border:1px solid var(--line);color:var(--tx3)}
.tl .actor.ag{color:var(--tx3);border-color:var(--line)} .tl .actor.ag.fired{color:var(--bad);border-color:rgba(248,81,73,.4)}
.tl .actor.op{color:var(--warn);border-color:rgba(210,153,34,.4)} .tl .actor.you{color:var(--tx2);border-color:var(--tx3)}
.tl .step.end .dot{background:var(--tx3);border-color:var(--tx3)}
.tl .step.end.high .dot{background:var(--warn);border-color:var(--warn)} .tl .step.end.crit .dot{background:var(--bad);border-color:var(--bad)}
.tl .step.end.high .actor.you{color:var(--warn);border-color:rgba(210,153,34,.4)} .tl .step.end.crit .actor.you{color:var(--bad);border-color:rgba(248,81,73,.4)}
.tl .step.end.high .concl{color:var(--warn)} .tl .step.end.crit .concl{color:var(--bad)}
.tl .note{font-size:13px;color:var(--tx2);font-style:italic;background:rgba(210,153,34,.06);border-left:2px solid rgba(210,153,34,.4);padding:6px 10px;border-radius:0 6px 6px 0;margin-top:3px}
.datagap .staged{margin-top:9px;padding-top:9px;border-top:1px dashed rgba(210,153,34,.3);font:11px var(--mono);color:var(--tx3)}
.ctable td.v.missing{color:var(--tx3);font-style:italic}
.grp{font:9.5px var(--mono);letter-spacing:.5px;text-transform:uppercase;color:var(--tx3);margin:2px 0 9px}
.terminal-note{font:10.5px var(--mono);color:var(--tx3);line-height:1.5;text-align:center}
```

- [ ] **Step 2: Manual verification**

Run/refresh the served app (Task 5, Step 9). Confirm the board and both case views match the mockups: criticality-coloured left borders, tier chips, animated shimmering urgency bars (breach card pulses + shows `⤒ bumped to top`), grey-by-default provenance, the case view's grey/red-when-fired agent badges, the amber (High) / red (Critical) end node, greyed `— not captured` fraud rows, and the floating nav. Leaving to another pill returns the app to normal page flow (no clipped content).

- [ ] **Step 3: Commit**

```bash
git add sample/styles.css
git commit -m "feat(sample): specialist board + case view styles"
```

---

## Self-Review

**Spec coverage** (spec §-by-§ → task):
- §2 two-axis criticality/urgency → Task 2 (`bar` + `crit` fields), Task 3 (`renderUrgencyBar` + criticality border).
- §3 board (full-height, per-column scroll, floating nav, grounded toolbar, two-zone claim-locks) → Task 3 (render) + Task 5 (routing, claim, filter) + Task 6 (shell/scroll CSS).
- §4 card signal system (border+tier, animated bar, provenance, outcomes, colour discipline) → Task 2/3/6.
- §5 case view (60/40, stacked actor history, terminal rail + capture, data gap) → Task 4 + Task 5 (capture reuse) + Task 6.
- §6 fraud variant (agent-direct, staged, missing-data rows) → Task 2 (`iss_099`) + Task 4.
- §7 cross-board retrofits (`Review→Claim`, `3 online`) → Task 1. (Pipeline nav + "policy couldn't decide" already shipped with the monitor.)
- §8 fixtures mapping → Task 2.
- §9 non-goals (real engine, roles, cross-board search) → intentionally omitted.

**Placeholder scan:** the only intentional token is `REF<nn>` in the two `dataGap.html` strings — explicitly resolved by `resolveRefs()` in Task 4 (tested by the `data-line="55"` / `data-line="66"` assertions). No `TBD`/`TODO`.

**Type consistency:** `Card`/`Bar`/`Prov`/`CaseDetail`/`Node`/`RailBtn` shapes defined in Task 2 are consumed with matching field names in Tasks 3–4 (`c.crit`, `c.bar.fillPct`, `c.prov.mode`, `n.actorClass`, `n.endCrit`, `b.variant`). `renderSpecialistCard(card, opts)`, `renderUrgencyBar(bar)`, `renderCaseView(caseDetail)`, `renderSpecialistCardClaimed(c)` names are identical across Tasks 3–6 and `app.js`.

---

**Plan complete and saved to `docs/plans/2026-07-26-specialist-board.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
