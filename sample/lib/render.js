const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const URGENCY_CLASS = { breach: 'u-breach', soon: 'u-soon', none: 'u-none' };
const SLA_CLASS = { breach: 'breach', soon: 'soon', none: 'none' };

function riskTag(display) {
  return display.isHighValue
    ? '<span class="rtag hv">high-value</span>'
    : `<span class="rtag">risk ${esc(display.riskScore)}</span>`;
}

// "why it's here" chip on the card
function whyChip(why) {
  if (why.face === 'recommend') return `<div class="rec-inline"><div class="l">✓ ${esc(why.lead)}</div></div>`;
  if (why.face === 'escalate') return `<span class="chip esc">${esc(why.lead)}</span>`;
  return `<span class="chip none">${esc(why.lead)}</span>`; // no_rule
}

// primary card context action (second button)
function cardAction(decision) {
  const rec = decision.actions.recommended;
  if (rec) return `<button class="cbtn go" data-action="recommended">${esc(rec.label.replace(/^[▲✓◆]\s*/, ''))}</button>`;
  return '<button class="cbtn" data-action="open">Review</button>';
}

export function renderCard(vm) {
  const { display: d, decision: dec } = vm;
  return `<div class="tk ${URGENCY_CLASS[dec.urgency.level]}" data-issue="${esc(d.id)}">
    <div class="t1"><b>${esc(dec.typeLabelOverride || d.typeLabel)}</b><span class="amt">${esc(d.amountText)}</span></div>
    <div class="t2">${esc(d.id)} · ${esc(d.customerName)} · ${esc(d.merchant)} · ${d.ageDays}d</div>
    <div class="tags">${riskTag(d)}</div>
    <span class="sla ${SLA_CLASS[dec.urgency.level]}">${esc(dec.urgency.label)}</span>
    ${whyChip(dec.why)}
    <div class="cardacts">
      <button class="cbtn" data-action="open" data-issue="${esc(d.id)}">Open ticket</button>
      ${cardAction(dec)}
    </div>
  </div>`;
}

export function renderAgentSummary(s) {
  const t = s.totals;
  const rows = s.categories.map((c) => `<tr>
      <td class="cat">${esc(c.name)}</td><td>${c.resolved}</td><td>${c.waiting}</td>
      <td class="v-back">${c.backlog || '<span class="z">0</span>'}</td><td class="v-esc">${c.escalated || '<span class="z">0</span>'}</td>
    </tr>`).join('');
  return `<div class="agent">
    <div class="agent-h"><span class="ico">◆</span><h3>Virtual agent — today</h3>
      <span class="tag">machine · read-only</span><button class="agent-btn">Open agent view ▸</button></div>
    <details class="ag">
      <summary>
        <span class="tot ok"><span class="k">Auto-resolved</span><span class="v">${t.resolved}</span></span>
        <span class="tot watch"><span class="k">Waiting</span><span class="v">${t.waiting}</span></span>
        <span class="tot back"><span class="k">Sent to team backlog</span><span class="v">${t.backlog}</span></span>
        <span class="tot esc"><span class="k">Escalated to specialist</span><span class="v">${t.escalated}</span></span>
        <span class="more">per-category</span>
      </summary>
      <table class="mtx"><thead><tr><th>Category</th><th class="h-ok">Auto-resolved</th>
        <th class="h-watch">Waiting</th><th class="h-back">→ Team backlog</th><th class="h-esc">→ Specialist</th></tr></thead>
        <tbody>${rows}</tbody></table>
    </details>
  </div>`;
}

function column(title, count, note, vms, opts = {}) {
  const cards = vms.length ? vms.map(renderCard).join('')
    : `<div class="empty">${esc(opts.empty || 'Nothing here')}</div>`;
  const body = opts.resolvedSummary
    ? `<div class="resolved-sum"><b>${count} resolved by you</b> today<br><span class="mach">+ 214 resolved automatically by the agent</span></div>`
    : cards;
  return `<div class="col ${opts.shared ? 'shared' : ''}">
    <div class="col-h"><h4>${esc(title)}</h4><span class="n">${count}</span></div>
    ${note ? `<p class="col-note">${esc(note)}</p>` : ''}
    ${body}
  </div>`;
}

export function renderBoard(grouped, agentSummary) {
  return `${renderAgentSummary(agentSummary)}
  <div class="twozone">
    <div class="zone team">
      <div class="zhead"><span class="lbl">▤ Team backlog</span><span class="exp">Unassigned — anyone can pick these up.</span></div>
      ${column('Needs review', grouped.needs_review.length, 'Pick one; it moves to your work and leaves others\' view.', grouped.needs_review, { shared: true, empty: 'Backlog clear' })}
    </div>
    <div class="zone mine">
      <div class="zhead"><span class="lbl">◧ My work</span><span class="exp">Tickets you picked up — only you see &amp; act on these.</span></div>
      <div class="lanes">
        ${column('In review', grouped.in_review.length, 'Actively working now.', grouped.in_review, { empty: 'Nothing in review' })}
        ${column('On hold', grouped.on_hold.length, 'Parked, waiting on a customer/carrier.', grouped.on_hold, { empty: 'Nothing parked' })}
        ${column('Resolved', grouped.resolved.length, 'Closed by you today.', grouped.resolved, { resolvedSummary: true })}
      </div>
    </div>
  </div>`;
}
