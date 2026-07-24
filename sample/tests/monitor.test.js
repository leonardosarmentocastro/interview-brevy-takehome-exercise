import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONITOR } from '../data/monitor.js';

test('MONITOR log newest-first with valid kinds and numeric refs', () => {
  assert.ok(MONITOR.log.length >= 5);
  for (const e of MONITOR.log) {
    assert.ok(['grab', 'resolved', 'leak', 'escalated'].includes(e.kind));
    assert.ok(Array.isArray(e.refs) && e.refs.every((n) => typeof n === 'number'));
  }
});

test('MONITOR analysis records referenced by drill rows all exist', () => {
  for (const r of MONITOR.drill.rows) {
    assert.ok(MONITOR.analysis[r.analysis], `analysis ${r.analysis} present for row ${r.id}`);
  }
});

test('MONITOR intake items carry facts-only tables', () => {
  for (const it of MONITOR.intake) {
    assert.ok(Array.isArray(it.facts.ticket) && it.facts.ticket.length > 0);
    assert.ok(Array.isArray(it.facts.customer) && it.facts.customer.length > 0);
  }
});
