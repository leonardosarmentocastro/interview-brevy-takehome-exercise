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
