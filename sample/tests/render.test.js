import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard, renderBoard, renderAgentSummary, renderDetail, renderTimeline, renderRail, policyLink } from '../lib/render.js';

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
