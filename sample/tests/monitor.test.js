import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONITOR } from '../data/monitor.js';
import { renderStatStrip, renderAgentLog, renderIntakeCard, renderWaitCard, renderPipeline, renderMonitor } from '../lib/monitor.js';

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
