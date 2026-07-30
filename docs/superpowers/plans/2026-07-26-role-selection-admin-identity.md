# Role Selection & Admin Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution notes (same repo/toolchain as the specialist & monitor plans):**
> - Run the 3 tasks in sequence. Commit after each task (the commit *is* the checkpoint).
> - After Task 1 (adds JS), run `cd sample && npm test` and confirm green before moving on.
> - Tasks 2–3 are visual/interactive (DOM wiring + CSS). There are no DOM unit tests in this repo — verify by serving the app (`cd <repo-root> && python3 -m http.server 8000`, open `http://localhost:8000/sample/`) and checking the described behaviour. If you cannot open a browser, rely on the Task 1 node tests plus the "static HTML contains hook" assertions and proceed.
> - **Do not** refactor existing operator/monitor/specialist code beyond the exact changes named here. Preserve the dark-theme CSS tokens.
> - The design spec is `docs/superpowers/specs/2026-07-26-role-selection-admin-identity-design.md`; read it if a decision is unclear.

**Goal:** Add the MVP presentation opener — a role-selection modal (admin enabled; specialist/operator disabled) shown on arrival that lands the presenter on the virtual-agent view, plus a shared app header carrying an `ADM` identity chip and a per-board page title, which also folds the specialist board into the same content width as the other two boards.

**Architecture:** Extend the existing vanilla-ES-module app. A new module `sample/lib/shell.js` exposes two pure render functions — `renderRoleModal()` and `renderAppHeader(view)` — returning HTML strings (unit-tested with `node --test`, asserting substrings, the repo pattern). `app.js` injects the modal once at boot, prepends the header to each of the three board views, wires the identity chip to re-open the modal and the admin row to close it and land on the virtual-agent view, and stops applying the `specialist-mode` full-viewport takeover so the specialist board flows in the shared `.wrap` width. New CSS is appended to `sample/styles.css` reusing existing tokens.

**Tech Stack:** Vanilla JS (ES modules), `node:test` + `node:assert`, static HTML/CSS. No build step, no dependencies.

## Global Constraints

- **Dark theme only**, reuse existing tokens from `sample/styles.css`: `--bg --col --col2 --line --tx --tx2 --tx3 --ok --warn --bad --info --mono`. Do **not** redefine `:root`.
- **Stand-in, not real auth:** no credential entry, no persistence, no storage. A page reload shows the modal again.
- **Only Admin is enabled.** The specialist and operator rows are visibly disabled (dimmed, lock glyph, `requires auth` tag) and non-interactive.
- **Avatar glyph is `ADM`** (admin initials), info-blue accent, in the header identity chip.
- **Per-board titles (exact copy):** `Virtual agent — pipeline monitor` (layer 1 of 3), `Operator board — for human review` (layer 2 of 3), `Specialist board — for fraud & escalations` (layer 3 of 3).
- **Selecting Admin always lands on the virtual-agent view** (`showMonitor()`) — the top of the pipeline.
- **Bottom pipeline nav is untouched** (keeps its two-line labels).
- **Test command:** `cd sample && npm test` (alias for `node --test`). Focused: `node --test tests/shell.test.js`.
- **Commit style:** conventional commits, one per task.

---

### Task 1: Shell render module — `renderRoleModal()` + `renderAppHeader(view)`

Two pure render functions in a new module. Fully unit-testable — this is the task that carries the real test cycle.

**Files:**
- Create: `sample/lib/shell.js`
- Test: `sample/tests/shell.test.js`

**Interfaces:**
- Consumes: nothing (self-contained; defines its own `esc` helper like `lib/nav.js` does).
- Produces:
  - `renderRoleModal()` → HTML string: an overlay `<div class="overlay hidden" id="roleModal">` wrapping the modal. Contains three role rows; the admin row carries `data-action="pick-role" data-role="admin"`; the two disabled rows carry a `requires auth` tag and no action hook.
  - `renderAppHeader(view)` → HTML string for `view ∈ {'agent','operator','specialist'}`: an `.appbar` with an `.eyebrow` (`Pipeline · layer N of 3`), an `<h2>` title, and a `<button class="idchip" data-action="switch-role">` containing `<span class="ava">ADM</span>`. Unknown view ids fall back to the `agent` header.

- [ ] **Step 1: Write the failing tests** — create `sample/tests/shell.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { renderRoleModal, renderAppHeader } from '../lib/shell.js';

test('role modal lists three roles with admin enabled and the others disabled', () => {
  const html = renderRoleModal();
  // overlay starts hidden, addressable by id
  assert.match(html, /class="overlay hidden" id="roleModal"/);
  // all three roles present
  assert.match(html, /Admin/);
  assert.match(html, /Specialist/);
  assert.match(html, /Operator/);
  // only admin is actionable
  assert.match(html, /data-action="pick-role" data-role="admin"/);
  assert.match(html, /Continue/);
  // exactly two disabled rows carry the requires-auth tag
  assert.equal((html.match(/requires auth/g) || []).length, 2);
  // scope lines communicate the intended authorization scoping
  assert.match(html, /Sees only their own operator board/);
  assert.match(html, /Manager sees across all specialists/);
});

test('app header renders the operator title, eyebrow, and ADM identity chip', () => {
  const html = renderAppHeader('operator');
  assert.match(html, /Pipeline · layer 2 of 3/);
  assert.match(html, /Operator board — for human review/);
  assert.match(html, /class="ava">ADM</);
  assert.match(html, /data-action="switch-role"/);
});

test('app header renders the correct title per view', () => {
  assert.match(renderAppHeader('agent'), /layer 1 of 3/);
  assert.match(renderAppHeader('agent'), /Virtual agent — pipeline monitor/);
  assert.match(renderAppHeader('specialist'), /layer 3 of 3/);
  assert.match(renderAppHeader('specialist'), /Specialist board — for fraud/);
});

test('app header falls back to the agent header for an unknown view', () => {
  assert.match(renderAppHeader('nope'), /layer 1 of 3/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sample && node --test tests/shell.test.js`
Expected: FAIL — cannot find module `../lib/shell.js`.

- [ ] **Step 3: Create `sample/lib/shell.js`**

```js
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEADERS = {
  agent:      { layer: 1, title: 'Virtual agent — pipeline monitor' },
  operator:   { layer: 2, title: 'Operator board — for human review' },
  specialist: { layer: 3, title: 'Specialist board — for fraud & escalations' },
};

export function renderAppHeader(view) {
  const h = HEADERS[view] || HEADERS.agent;
  return `<div class="appbar">
    <div class="ttl"><span class="eyebrow">Pipeline · layer ${h.layer} of 3</span><h2>${esc(h.title)}</h2></div>
    <div class="spacer"></div>
    <button class="idchip" data-action="switch-role" aria-label="Switch role">
      <span class="ava">ADM</span>
      <span class="who"><span class="r">Admin</span><span class="h">switch role</span></span>
      <span class="car">▾</span>
    </button>
  </div>`;
}

const ROLES = [
  { enabled: true,  name: 'Admin',      mgr: '',          avatar: 'A',
    scope: 'Full visibility across all three pipeline layers — virtual agent, operator & specialist.' },
  { enabled: false, name: 'Specialist', mgr: ' / manager', avatar: '🔒',
    scope: 'Sees the specialist board. Manager sees across all specialists.' },
  { enabled: false, name: 'Operator',   mgr: ' / manager', avatar: '🔒',
    scope: 'Sees only their own operator board. Manager sees across all operators.' },
];

function roleRow(r) {
  const cls = r.enabled ? 'role admin' : 'role off';
  const hook = r.enabled ? ' data-action="pick-role" data-role="admin"' : '';
  const right = r.enabled ? '<span class="cont">Continue&nbsp;→</span>' : '<span class="rtag">requires&nbsp;auth</span>';
  return `<div class="${cls}"${hook}>
    <div class="rava">${r.avatar}</div>
    <div class="rbody"><div class="rname">${esc(r.name)}<span class="mgr">${esc(r.mgr)}</span></div>
      <div class="rscope">${esc(r.scope)}</div></div>
    ${right}
  </div>`;
}

export function renderRoleModal() {
  return `<div class="overlay hidden" id="roleModal">
    <div class="modal">
      <div class="mh"><span class="dot"></span><span class="brand">PAYMENT ISSUE CONSOLE</span></div>
      <div class="mtitle">Who's operating the console?</div>
      <p class="mnote">Authentication isn't wired in this MVP — <code>pick a role to continue</code>.</p>
      ${ROLES.map(roleRow).join('')}
      <div class="mfoot">Only <b>Admin</b> is enabled in this build.</div>
    </div>
  </div>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sample && node --test tests/shell.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to confirm nothing else broke**

Run: `cd sample && npm test`
Expected: PASS (existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add sample/lib/shell.js sample/tests/shell.test.js
git commit -m "feat(sample): shell module — role-selection modal + app header renderers"
```

---

### Task 2: Wire the shell into the app — modal on arrival, header on every board, chip re-opens, specialist normalized

Inject the modal, prepend the header to the three board views, add the click wiring, land admin on the virtual-agent view, and stop applying the `specialist-mode` full-viewport takeover so the specialist board flows in the shared `.wrap` width.

**Files:**
- Modify: `sample/index.html` (add a `#roleHost` container after `#app`)
- Modify: `sample/app.js` (import shell renderers; prepend header in `showMonitor`/`showBoard`/`showSpecialist`; inject + open modal in `boot`; add `openRoleModal`/`closeRoleModal`; wire `switch-role` and `pick-role`; drop `setSpecialistMode(true)` in the specialist routes)

**Interfaces:**
- Consumes: `renderRoleModal`, `renderAppHeader` from `./lib/shell.js` (Task 1); existing `showMonitor`, `showBoard`, `showSpecialist`, `showSpecialistCase`, `renderMonitor`, `renderBoard`, `renderSpecialistBoard`, `renderPipelineNav`.
- Produces: no new exports (app-internal wiring).

- [ ] **Step 1: Add the modal host to `sample/index.html`**

Insert a host div immediately after the `#app` main element (before `#polmodal`):

```html
  <main id="app" class="wrap"></main>
  <div id="roleHost"></div>
```

- [ ] **Step 2: Import the shell renderers in `sample/app.js`**

Add to the import block at the top of `sample/app.js` (after the `renderPipelineNav` import):

```js
import { renderRoleModal, renderAppHeader } from './lib/shell.js';
```

- [ ] **Step 3: Prepend the header to the three board views**

In `sample/app.js`, change the three board render lines so each begins with its header:

```js
function showBoard() {
  setSpecialistMode(false);
  app.innerHTML = renderAppHeader('operator') + renderBoard(groupByColumn(VIEW_MODELS), AGENT_SUMMARY) + renderPipelineNav('operator');
  window.scrollTo(0, 0);
}
function showMonitor() {
  setSpecialistMode(false);
  app.innerHTML = renderAppHeader('agent') + renderMonitor(MONITOR) + renderPipelineNav('agent');
  window.scrollTo(0, 0);
}
```

And the specialist board — note `setSpecialistMode(false)` (was `true`), so it flows in the shared `.wrap` width like the other two:

```js
function showSpecialist() {
  setSpecialistMode(false);
  app.innerHTML = renderAppHeader('specialist') + renderSpecialistBoard(SPECIALIST) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}
```

Leave `showDetail`, `showDrill`, and `showSpecialistCase` unchanged (transient sub-views keep their own back navigation; the header lives on the three boards per the spec). In `showSpecialistCase`, change its `setSpecialistMode(true)` to `setSpecialistMode(false)` as well so the case view flows in the shared width and does not re-enter full-viewport mode:

```js
function showSpecialistCase(id) {
  const c = SPECIALIST.cases[id];
  if (!c) { toast(`${id} — case view is demoed on iss_003 & iss_099`); return; }
  setSpecialistMode(false);
  app.innerHTML = renderCaseView(c) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}
```

- [ ] **Step 4: Add modal open/close helpers and change `boot` to open the modal over the virtual-agent view**

In `sample/app.js`, add these helpers (place them near the other top-level functions, e.g. just above `boot`):

```js
function openRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }
```

Then change the end of `boot()` — replace the `showBoard();` call with rendering the modal into its host, showing the virtual-agent view behind it, and opening the modal:

```js
    POLICY_LINES = policiesText.split('\n');
    VIEW_MODELS = joinIssues({ customers, transactions, issues }, DECISIONS, NOW);
    document.getElementById('roleHost').innerHTML = renderRoleModal();
    showMonitor();
    openRoleModal();
```

- [ ] **Step 5: Wire the identity chip (open) and the admin row (close + land on virtual agent)**

The header (and its chip) live inside `#app`, so add the `switch-role` branch to the existing `app` click handler. Add this line near the top of the existing `app.addEventListener('click', (e) => { ... })` that handles the pipeline nav (the second one, starting at the `// pipeline nav` comment):

```js
  if (e.target.closest('[data-action="switch-role"]')) { openRoleModal(); return; }
```

The modal lives in `#roleHost` (outside `#app`), so add a dedicated handler for it near the bottom of `sample/app.js`:

```js
document.getElementById('roleHost').addEventListener('click', (e) => {
  if (e.target.closest('[data-action="pick-role"]')) { closeRoleModal(); showMonitor(); return; }
});
```

- [ ] **Step 6: Serve and verify the flow**

Run: `cd <repo-root> && python3 -m http.server 8000` then open `http://localhost:8000/sample/`.
Expected:
- On load, the **role modal** is shown over a blurred virtual-agent board. Admin row is highlighted with `Continue →`; the specialist and operator rows are dimmed/locked with `requires auth` and do not respond to clicks.
- Clicking **Admin** closes the modal; you are on the **virtual-agent** view, whose header reads `Pipeline · layer 1 of 3 · Virtual agent — pipeline monitor` with an `ADM` chip top-right.
- Using the bottom nav to move to the **Operator** and **Specialist** boards shows the correct header title on each, with the `ADM` chip present.
- Clicking the **ADM chip** on any board re-opens the role modal; picking Admin again returns to the virtual-agent view.
- The **specialist board** now renders at the same content width as the other two (no longer edge-to-edge full-viewport). Page scroll, not per-column scroll — this is the intended trade for cross-board consistency.

(If a browser is unavailable: confirm `index.html` contains `id="roleHost"`, and that `app.js` calls `renderAppHeader` in all three board views, injects `renderRoleModal`, and no longer passes `true` to `setSpecialistMode`.)

- [ ] **Step 7: Run the suite (guards against import/typo regressions) and commit**

```bash
cd sample && npm test
git add sample/index.html sample/app.js
git commit -m "feat(sample): role modal on arrival, shared app header, ADM identity chip"
```

Expected: existing + Task 1 tests PASS.

---

### Task 3: Styles — modal, app header, identity chip

Append CSS for the new chrome, reusing existing tokens. Purely visual; verified by eye.

**Files:**
- Modify: `sample/styles.css` (append a new block at the end)

**Interfaces:**
- Consumes: the class names emitted by `lib/shell.js` (Task 1) and the existing `:root` tokens.
- Produces: no JS interface.

- [ ] **Step 1: Append the header + chip styles to `sample/styles.css`**

```css
/* ===== shared app header (all three boards) ===== */
.appbar{display:flex;align-items:center;gap:14px;padding:10px 14px;background:var(--col);
  border:1px solid var(--line);border-radius:10px;margin-bottom:16px}
.appbar .ttl{display:flex;flex-direction:column;min-width:0}
.appbar .eyebrow{font:9.5px var(--mono);letter-spacing:.5px;text-transform:uppercase;color:var(--tx3)}
.appbar .ttl h2{margin:1px 0 0;font-size:15px;font-weight:700}
.appbar .spacer{flex:1}
.idchip{display:flex;align-items:center;gap:9px;padding:5px 10px 5px 6px;border:1px solid var(--line);
  border-radius:99px;background:var(--col2);cursor:pointer;transition:.12s;font:inherit;color:inherit}
.idchip:hover{border-color:rgba(88,166,255,.5);background:rgba(88,166,255,.08)}
.idchip .ava{width:30px;height:30px;border-radius:99px;display:grid;place-items:center;flex:0 0 30px;
  background:rgba(88,166,255,.16);border:1px solid rgba(88,166,255,.5);color:var(--info);
  font:700 10px var(--mono);letter-spacing:.5px}
.idchip .who{display:flex;flex-direction:column;line-height:1.15;text-align:left}
.idchip .who .r{font-size:12.5px;font-weight:600}
.idchip .who .h{font:9px var(--mono);letter-spacing:.3px;text-transform:uppercase;color:var(--tx3)}
.idchip .car{color:var(--tx3);font-size:11px}
```

- [ ] **Step 2: Append the role-modal styles to `sample/styles.css`**

```css
/* ===== role-selection modal ===== */
.overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(4,6,9,.55);
  backdrop-filter:blur(3px);z-index:1200;transition:opacity .18s}
.overlay.hidden{opacity:0;pointer-events:none}
.overlay .modal{width:410px;max-width:92%;background:var(--col);border:1px solid var(--line);border-radius:14px;
  padding:20px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
.modal .mh{display:flex;align-items:center;gap:9px;margin-bottom:3px}
.modal .mh .dot{width:7px;height:7px;border-radius:99px;background:var(--ok)}
.modal .mh .brand{font:700 11px var(--mono);letter-spacing:.4px;color:var(--tx2)}
.modal .mtitle{font-size:16px;font-weight:700;margin:8px 0 2px}
.modal .mnote{color:var(--tx3);font-size:12px;margin:0 0 15px}
.modal .mnote code{font-family:var(--mono);color:var(--warn)}
.modal .role{display:flex;gap:12px;align-items:center;border:1px solid var(--line);border-radius:10px;
  padding:12px 13px;margin-bottom:9px;background:var(--col2);transition:.12s}
.modal .role .rava{width:34px;height:34px;flex:0 0 34px;border-radius:9px;display:grid;place-items:center;
  font:700 12px var(--mono);background:#222a38;border:1px solid var(--line);color:var(--tx3)}
.modal .role .rbody{flex:1;min-width:0}
.modal .role .rname{font-weight:600;font-size:13.5px}
.modal .role .rname .mgr{color:var(--tx3);font-weight:400}
.modal .role .rscope{color:var(--tx3);font-size:12px;margin-top:3px}
.modal .role .rtag{font:9px var(--mono);letter-spacing:.4px;text-transform:uppercase;border:1px solid rgba(210,153,34,.4);
  border-radius:99px;padding:1px 7px;color:var(--warn);white-space:nowrap}
.modal .role .cont{font:700 11px var(--mono);color:var(--info);white-space:nowrap}
.modal .role.admin{border-color:rgba(88,166,255,.5);background:rgba(88,166,255,.07);cursor:pointer}
.modal .role.admin:hover{background:rgba(88,166,255,.13)}
.modal .role.admin .rava{background:rgba(88,166,255,.15);border-color:rgba(88,166,255,.5);color:var(--info)}
.modal .role.off{opacity:.5;cursor:not-allowed;filter:grayscale(.3)}
.modal .mfoot{font:11px var(--mono);color:var(--tx3);text-align:center;margin-top:11px}
.modal .mfoot b{color:var(--info)}
```

- [ ] **Step 3: Serve and verify appearance**

Run: `cd <repo-root> && python3 -m http.server 8000` then open `http://localhost:8000/sample/`.
Expected:
- The modal is centered, dark-themed, over a blurred board; admin row is blue-accented, the other two greyed with an amber `requires auth` pill.
- Every board shows the header bar (eyebrow + title left, `ADM` chip right), and the three boards read as the same app at the same width.
- The `ADM` chip highlights on hover.

- [ ] **Step 4: Commit**

```bash
git add sample/styles.css
git commit -m "feat(sample): styles for role modal, app header, and ADM identity chip"
```

---

## Self-Review

**Spec coverage:**
- §2 role-selection modal (Direction A, three rows, admin enabled, scope lines, disabled rows) → Task 1 (`renderRoleModal`) + Task 3 (styles).
- §3 landing behavior (modal on arrival, admin → virtual agent, no persistence) → Task 2 (`boot` + `pick-role` handler).
- §4 shared app header (eyebrow + per-board titles, consistent width) → Task 1 (`renderAppHeader`) + Task 2 (prepend to three views) + Task 2 specialist normalization + Task 3 styles.
- §5 admin identity chip (`ADM`, re-opens modal) → Task 1 (chip markup) + Task 2 (`switch-role` handler) + Task 3 styles.
- §6 untouched (bottom nav, board internals) → no task modifies them; confirmed by leaving `renderPipelineNav` and board render functions unchanged.
- §7 integration notes (new module, boot wiring, specialist width, tests) → Tasks 1–3 follow them exactly.
- §8 out of scope (no real auth, no persistence, no manager views) → nothing in the plan adds these.

**Placeholder scan:** none — every code and test step contains complete content.

**Type consistency:** `renderRoleModal()` / `renderAppHeader(view)` names, the `roleModal` id, and the `pick-role` / `switch-role` / `data-role="admin"` hooks are used identically across Tasks 1–3. `setSpecialistMode(false)` matches the existing signature in `app.js`. CSS selectors (`.appbar`, `.idchip .ava`, `.overlay`, `.modal .role.admin`, `.role.off`, `.rtag`, `.cont`, `.mgr`, `.eyebrow`) match the class names emitted by `shell.js`.

**Note on the one visually-uncertain step:** Task 2 stops applying `specialist-mode`, trading the specialist board's per-column independent scroll for page scroll at the shared width — this is the explicit intent of design §4/§7 (fix the fullscreen discrepancy). The dormant `body.specialist-mode` CSS rules become inert and are left in place (no functional effect once the class is never applied). Verify the specialist board and case view render acceptably in normal flow at Task 2 Step 6.
