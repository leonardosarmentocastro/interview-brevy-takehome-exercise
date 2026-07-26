import { joinIssues, groupByColumn } from './lib/viewmodel.js';
import { renderBoard, renderDetail, policyLink } from './lib/render.js';
import { DECISIONS, AGENT_SUMMARY } from './data/decisions.js';
import { renderMonitor, renderDrill, renderIntakeDrawer, renderResolvedDrawer, renderIntakeCard, renderWaitCard } from './lib/monitor.js';
import { renderPipelineNav } from './lib/nav.js';
import { renderRoleModal, renderAppHeader } from './lib/shell.js';
import { MONITOR } from './data/monitor.js';
import { renderSpecialistBoard, renderCaseView, renderSpecialistCardClaimed } from './lib/specialist.js';
import { SPECIALIST } from './data/specialist.js';

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
    document.getElementById('roleHost').innerHTML = renderRoleModal();
    showMonitor();
    openRoleModal();
  } catch (err) {
    app.innerHTML = `<p style="padding:24px;color:var(--bad)">${err.message}. Run <code>python3 -m http.server 8000</code> from the repo root and open <code>/sample/</code>.</p>`;
  }
}

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
function showDrill() {
  setSpecialistMode(false);
  app.innerHTML = renderDrill(MONITOR.drill) + renderPipelineNav('agent');
  window.scrollTo(0, 0);
}

function showDetail(issueId) {
  setSpecialistMode(false);
  const vm = VIEW_MODELS.find((v) => v.issue.id === issueId);
  if (!vm) return;
  app.innerHTML = renderDetail(vm);
  window.scrollTo(0, 0);
}

function setSpecialistMode(on) {
  document.body.classList.toggle('specialist-mode', on);
}
function showSpecialist() {
  setSpecialistMode(false);
  app.innerHTML = renderAppHeader('specialist') + renderSpecialistBoard(SPECIALIST) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}
function showSpecialistCase(id) {
  const c = SPECIALIST.cases[id];
  if (!c) { toast(`${id} — case view is demoed on iss_003 & iss_099`); return; }
  setSpecialistMode(false);
  app.innerHTML = renderCaseView(c) + renderPipelineNav('specialist');
  window.scrollTo(0, 0);
}

function openRoleModal() { document.getElementById('roleModal')?.classList.remove('hidden'); }
function closeRoleModal() { document.getElementById('roleModal')?.classList.add('hidden'); }

// event delegation for navigation (policy dialog + capture added in Task 7)
app.addEventListener('click', (e) => {
  const openEl = e.target.closest('[data-action="open"]');
  if (openEl) { showDetail(openEl.getAttribute('data-issue') || openEl.closest('[data-issue]')?.getAttribute('data-issue')); return; }
  const cardEl = e.target.closest('.tk[data-issue]');
  if (cardEl && !e.target.closest('button')) { showDetail(cardEl.getAttribute('data-issue')); return; }
  if (e.target.closest('[data-action="back"]')) { e.preventDefault(); showBoard(); return; }
});

boot();

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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePolicy(); closeDrawer(); } });

function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--col2);border:1px solid var(--ok);color:var(--ok);padding:10px 16px;border-radius:8px;font:13px var(--mono);z-index:1000;box-shadow:0 10px 30px rgba(0,0,0,.5)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function openDrawerHTML(html) {
  const host = document.getElementById('drawerHost');
  if (host) host.innerHTML = html;
}
function closeDrawer() {
  const host = document.getElementById('drawerHost');
  if (host) host.innerHTML = '';
}

app.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="switch-role"]')) { openRoleModal(); return; }
  // pipeline nav
  const nav = e.target.closest('.pstep[data-view]');
  if (nav) {
    const view = nav.getAttribute('data-view');
    if (view === 'agent') showMonitor();
    else if (view === 'operator') showBoard();
    else showSpecialist();
    return;
  }
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
  // simulator
  if (e.target.closest('[data-action="sim-poll"]')) { simPoll(); return; }
  if (e.target.closest('[data-action="sim-leak"]')) { simLeak(); return; }
  if (e.target.closest('[data-action="sim-next"]')) { simNext(); return; }
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
  if (e.target.closest('[data-action="sb-search"]')) applySpecialistFilter();
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

document.getElementById('roleHost').addEventListener('click', (e) => {
  if (e.target.closest('[data-action="pick-role"]')) { closeRoleModal(); showMonitor(); return; }
});
