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

import { renderUrgencyBar, renderSpecialistCard, renderSpecialistToolbar, renderSpecialistBoard } from '../lib/specialist.js';

test('renderUrgencyBar shows elapsed, act-by/re-evaluate word, and breach state', () => {
  const act = renderUrgencyBar({ fillPct: 35, kind: 'act', word: 'act-by', limit: 'window 4h', elapsed: 'in queue 20m' });
  assert.match(act, /in queue 20m/);
  assert.match(act, /act-by/);
  assert.match(act, /⚠/);
  const breach = renderUrgencyBar({ fillPct: 100, kind: 'breach', word: 'act-by', limit: 'window spent — act now', elapsed: '' });
  assert.match(breach, /uend breach/);
  const reval = renderUrgencyBar({ fillPct: 55, kind: 'reval', word: 're-evaluate', limit: 'carrier ETA Jan 14', elapsed: 'in queue 3h' });
  assert.match(reval, /⟳/);
});

test('renderSpecialistCard: shared card has criticality border, provenance, Claim', () => {
  const html = renderSpecialistCard(SPECIALIST.queue[2], {}); // iss_003 High manual
  assert.match(html, /class="tk c-high"[^>]*data-case="iss_003"/);
  assert.match(html, /class="crt high">High</);
  assert.match(html, /<b>manually escalated<\/b>/);
  assert.match(html, /data-line="53"/);
  assert.match(html, /data-action="open-case" data-id="iss_003"/);
  assert.match(html, /data-action="claim" data-id="iss_003"/);
});

test('renderSpecialistCard: breach card pulses + bumps; auto card reads "automatically escalated"', () => {
  const html = renderSpecialistCard(SPECIALIST.queue[0], {}); // iss_087 breach auto
  assert.match(html, /class="tk c-crit breach"/);
  assert.match(html, /⤒ bumped to top/);
  assert.match(html, /<b>automatically escalated<\/b>/);
});

test('renderSpecialistCard: resolved card shows outcome + no bar + no Claim', () => {
  const html = renderSpecialistCard(SPECIALIST.mine.resolved[0], { resolved: true });
  assert.match(html, /class="outcome"/);
  assert.match(html, /fraud confirmed/);
  assert.doesNotMatch(html, /class="ubar"/);
  assert.doesNotMatch(html, /data-action="claim"/);
});

test('renderSpecialistBoard: two zones, grounded chips, scroll container, my-work lanes', () => {
  const html = renderSpecialistBoard(SPECIALIST);
  assert.match(html, /Escalation queue/);
  assert.match(html, /Needs investigation/);
  assert.match(html, /id="sb-queue"/);
  assert.match(html, /data-cat="fraud"/);       // grounded filter chip
  assert.match(html, /Investigating/);
  assert.match(html, /On hold/);
  assert.match(html, /3 online/);
});

import { renderCaseHistory, renderCaseView } from '../lib/specialist.js';

test('renderCaseHistory: agent badge grey by default, red when fired, end node inherits criticality', () => {
  const html = renderCaseHistory(SPECIALIST.cases.iss_003.history);
  assert.match(html, /class="actor ag">Agent/);        // not-fired agent, plain grey
  assert.match(html, /class="actor ag fired">Agent/);  // fired agent
  assert.match(html, /class="step end high"/);         // High case → amber end node
  assert.match(html, /Operator · Alex/);
  assert.match(html, /stuck in transit 5 days/);       // the operator note
});

test('renderCaseView (dispute): stacked history, terminal rail, no escalate, data-gap links resolved', () => {
  const html = renderCaseView(SPECIALIST.cases.iss_003);
  assert.match(html, /data-action="sb-back"/);
  assert.match(html, /MANUALLY ESCALATED BY OPERATOR/i);
  assert.match(html, /class="grid"/);
  assert.match(html, /Refund customer \$249/);
  assert.match(html, /data-action="recommended"/);     // reuses existing capture handler
  assert.doesNotMatch(html, /<button[^>]*>[^<]*escalate/i); // terminal tier — no escalate action
  assert.match(html, /data-line="55"/);                // REF55 resolved to a real policy link
  assert.match(html, /does not return to the operator/);
});

test('renderCaseView (fraud): critical end node, staged note, missing-data rows', () => {
  const html = renderCaseView(SPECIALIST.cases.iss_099);
  assert.match(html, /class="step end crit"/);
  assert.match(html, /Staged case/);
  assert.match(html, /class="v missing">— not captured/);
  assert.match(html, /Confirm fraud/);
  assert.match(html, /data-line="66"/);
});
