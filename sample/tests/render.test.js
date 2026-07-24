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
