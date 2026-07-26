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
