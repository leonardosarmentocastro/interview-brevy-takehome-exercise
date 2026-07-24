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

export function renderIntakeCard(it) {
  return `<div class="tk eval" data-intake="${esc(it.id)}">
    <div class="t1"><b>${esc(it.type)}</b><span class="amt">${esc(it.amountText)}</span></div>
    <div class="t2">${esc(it.meta)}</div>
    <span class="blocker eval"><span class="evaldot"></span> evaluating against policy…</span>
    <button class="viewbtn" data-action="open-intake" data-id="${esc(it.id)}">View ticket (facts only) →</button>
  </div>`;
}

export function renderWaitCard(it) {
  return `<div class="tk wait" data-wait="${esc(it.id)}">
    <div class="t1"><b>${esc(it.type)}</b><span class="amt">${esc(it.amountText)}</span></div>
    <div class="t2">${esc(it.meta)}</div>
    <span class="blocker">${esc(it.blocker)}</span>
    <div class="hatch">
      <button class="hbtn" data-action="request-review" data-id="${esc(it.id)}">Request human review →</button>
      <button class="hbtn esc" data-action="escalate" data-id="${esc(it.id)}">Escalate to specialist →</button>
    </div>
  </div>`;
}

function renderSimulator() {
  return `<div class="sim">
    <div class="simh">⚡ Simulate intake (prototype)</div>
    <div class="simrow">
      <button class="simbtn" data-action="sim-poll">Poll vendor +5</button>
      <button class="simbtn leak" data-action="sim-leak">Inject a leak</button>
    </div>
    <div class="simrow" style="margin-top:6px"><button class="simbtn step" data-action="sim-next">▶ Process next</button></div>
  </div>`;
}

function renderResolvedPanel(r) {
  const rows = r.recent.map((x) =>
    `<div class="rrow" data-action="open-resolved" data-id="${esc(x.id)}"><span class="rt"><b>${esc(x.id)}</b> · ${esc(x.typeShort)}</span><span class="chev">${esc(x.note)} ›</span></div>`).join('');
  return `<div class="done-tile"><div class="big" id="count-resolved-big">${r.count}</div><div class="cap">resolved today with no human involved</div></div>
    <div class="done-recent"><div class="rh">last 5 resolved — click to inspect reasoning</div>${rows}</div>
    <button class="drill" data-action="drill">Drill into all ${r.count} ▸</button>`;
}

export function renderPipeline(m) {
  const intake = m.intake.map(renderIntakeCard).join('');
  const wait = m.waiting.map(renderWaitCard).join('');
  return `<div class="pipe">
    <div class="lane intake">
      <div class="lane-h"><h3>Intake · unprocessed</h3><span class="n" id="count-intake">${m.intake.length}</span></div>
      <p class="lane-note">The mouth of the pipe — tickets that arrived from the vendor feed and haven’t been evaluated yet. Near-zero in steady state; fills on bursts.</p>
      ${renderSimulator()}
      <div id="intake-cards">${intake}</div>
    </div>
    <div class="arrowcol">⟶</div>
    <div class="lane wait">
      <div class="lane-h"><h3>Waiting · system-managed</h3><span class="n" id="count-waiting">${m.waiting.length + (m.waitingMore || 0)}</span></div>
      <p class="lane-note">The machine is holding these automatically — a timer, a customer nudge, or a grace clock. No human owns them yet. Each card says exactly what it’s blocked on.</p>
      <div id="wait-cards">${wait}</div>
      ${m.waitingMore ? `<div class="intake-empty" style="margin-top:2px">+ ${m.waitingMore} more waiting</div>` : ''}
    </div>
    <div class="arrowcol">⟶</div>
    <div class="lane done">
      <div class="lane-h"><h3>Resolved · automatically</h3><span class="n" id="count-resolved">${m.resolved.count}</span></div>
      <p class="lane-note">The bulk of traffic. Never a wall of cards — a rolling count you drill into. Click any recent ticket to see the agent’s reasoning.</p>
      ${renderResolvedPanel(m.resolved)}
    </div>
  </div>`;
}

export function renderMonitor(m) {
  return `${renderMonitorHeader()}${renderStatStrip(m.stats)}${renderAgentLog(m.log)}${renderPipeline(m)}<div id="drawerHost"></div>`;
}
