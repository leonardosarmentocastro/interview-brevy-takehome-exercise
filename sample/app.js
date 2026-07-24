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
