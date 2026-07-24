import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONITOR } from '../data/monitor.js';
import { renderStatStrip, renderAgentLog, renderIntakeCard, renderWaitCard, renderPipeline, renderMonitor, renderIntakeDrawer, renderResolvedDrawer, renderDrill } from '../lib/monitor.js';

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

test('renderStatStrip shows four totals with stable ids', () => {
  const html = renderStatStrip(MONITOR.stats);
  assert.match(html, /id="stat-resolved"[^>]*>214</);
  assert.match(html, /Sent for human review/);
  assert.match(html, /id="stat-human"[^>]*>2</);
});

test('renderAgentLog is a collapsed details with latest line + policy links', () => {
  const html = renderAgentLog(MONITOR.log);
  assert.match(html, /<details class="log">/);
  assert.match(html, /class="latest"/);
  assert.match(html, /grabbed <b>iss_061<\/b>/);       // latest line, trusted HTML kept
  assert.match(html, /data-line="77"/);                 // a ref rendered as policy link
  assert.match(html, /lrow leak/);                      // leak entries get the class
  assert.match(html, /7 events today/);
});

test('renderIntakeCard has evaluating state + facts-only view hook', () => {
  const html = renderIntakeCard(MONITOR.intake[0]);
  assert.match(html, /data-intake="iss_061"/);
  assert.match(html, /evaluating against policy/);
  assert.match(html, /data-action="open-intake" data-id="iss_061"/);
});

test('renderWaitCard shows blocker + policy-language hatches', () => {
  const html = renderWaitCard(MONITOR.waiting[0]);
  assert.match(html, /nudge sent — awaiting customer/);
  assert.match(html, /Request human review →/);
  assert.match(html, /Escalate to specialist →/);
  assert.match(html, /data-action="request-review"/);
});

test('renderPipeline has three lanes, counts, sim + drill hooks', () => {
  const html = renderPipeline(MONITOR);
  assert.match(html, /Intake · unprocessed/);
  assert.match(html, /Waiting · system-managed/);
  assert.match(html, /Resolved · automatically/);
  assert.match(html, /id="count-intake"/);
  assert.match(html, /data-action="sim-poll"/);
  assert.match(html, /data-action="drill"/);
  assert.match(html, /data-action="open-resolved" data-id="iss_004"/);
});

test('renderMonitor mounts a drawer host', () => {
  assert.match(renderMonitor(MONITOR), /<div id="drawerHost"><\/div>/);
});

test('renderIntakeDrawer is facts-only (no recommendation/timeline)', () => {
  const html = renderIntakeDrawer(MONITOR.intake[0]);
  assert.match(html, /Intake — not yet evaluated/);
  assert.match(html, /No agent analysis yet/);
  assert.match(html, /data-action="close-drawer"/);
  assert.doesNotMatch(html, /class="rec"/);
  assert.doesNotMatch(html, /class="tl"/);
});

test('renderResolvedDrawer shows recommendation, timeline, audit', () => {
  const html = renderResolvedDrawer(MONITOR.analysis.iss_004);
  assert.match(html, /AUTO-RESOLVED — refund approved/);
  assert.match(html, /class="tl"/);
  assert.match(html, /RULE/);
  assert.match(html, /EVIDENCE/);
  assert.match(html, /data-line="77"/);
  assert.match(html, /policy version:/);
});

test('renderDrill has chips, searchable rows, pattern callout, drawer host', () => {
  const html = renderDrill(MONITOR.drill);
  assert.match(html, /data-action="back-monitor"/);
  assert.match(html, /class="chip on" data-cat="all"/);
  assert.match(html, /data-action="drill-search"/);
  assert.match(html, /data-cat="refund" data-txt="[^"]*" data-action="open-resolved" data-id="iss_004"/);
  assert.match(html, /class="pattern"/);
  assert.match(html, /92 of 214/);
  assert.match(html, /<div id="drawerHost"><\/div>/);
});
