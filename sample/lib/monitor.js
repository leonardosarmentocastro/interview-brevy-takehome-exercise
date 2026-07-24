import { policyLink } from './render.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LOG_CLASS = { resolved: 'res', leak: 'leak', escalated: 'esc', grab: '' };
const refsHtml = (refs) => (refs && refs.length ? ' · ' + refs.map((n) => policyLink(n)).join(', ') : '');

export function renderMonitorHeader() {
  return `<div class="mhead"><span class="ico">◆</span><h1>Virtual agent — pipeline monitor</h1>
      <span class="tag">machine · read-only</span>
      <span class="live"><span class="dot"></span>live · updates as tickets flow</span></div>
    <p class="sub">Everything the automation is handling with no human involved. You don’t move cards here — the clock does. You can only pull a card out (request review / escalate) if you need to.</p>`;
}

export function renderStatStrip(s) {
  return `<div class="stats">
    <div class="stat ok"><div class="k">Auto-resolved today</div><div class="v" id="stat-resolved">${s.resolved}</div><div class="d">${s.autoPct}% of all intake</div></div>
    <div class="stat watch"><div class="k">Waiting (system-managed)</div><div class="v" id="stat-waiting">${s.waiting}</div><div class="d">retries · nudges · grace clocks</div></div>
    <div class="stat back"><div class="k">→ Sent for human review</div><div class="v" id="stat-human">${s.humanReview}</div><div class="d">policy couldn’t decide</div></div>
    <div class="stat esc"><div class="k">→ Escalated to specialist</div><div class="v" id="stat-escalated">${s.escalated}</div><div class="d">disputes over $200</div></div>
  </div>`;
}

export function renderAgentLog(log) {
  const latest = log[0];
  const rows = log.map((e) =>
    `<div class="lrow ${LOG_CLASS[e.kind]}"><span class="lt">${esc(e.t)}</span><span class="lx">${e.text}${refsHtml(e.refs)}</span></div>`).join('');
  return `<details class="log">
    <summary>
      <span class="llead"><span class="d"></span>Agent log</span>
      <span class="latest"><b>${esc(latest.t)}</b> · ${latest.text}</span>
      <span class="count">${log.length} events today</span>
    </summary>
    <div class="stream">${rows}</div>
  </details>`;
}
