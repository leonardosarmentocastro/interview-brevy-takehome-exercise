import { joinIssues, groupByColumn } from './lib/viewmodel.js';
import { renderBoard, renderDetail } from './lib/render.js';
import { DECISIONS, AGENT_SUMMARY } from './data/decisions.js';
import { renderMonitor, renderDrill, renderIntakeDrawer, renderResolvedDrawer } from './lib/monitor.js';
import { renderPipelineNav } from './lib/nav.js';
import { MONITOR } from './data/monitor.js';

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
