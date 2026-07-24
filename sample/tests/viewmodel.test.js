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
