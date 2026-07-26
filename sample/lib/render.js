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
  return '<button class="cbtn" data-action="open">Claim</button>';
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
      <span class="tag">machine · read-only</span></div>
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
      <div class="zhead"><span class="lbl">▤ Team backlog</span><span class="exp">Unassigned — anyone can pick these up · <span class="online">3 online</span></span></div>
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

export function policyLink(n) {
  return `<span class="plink" data-line="${n}">policies.md:${n}</span>`;
}

const TL_CLASS = { not_met: 'n', fired: 'f', cant_evaluate: 'm' };
const TL_STATUS = { not_met: 'not met', fired: '▲ fired', cant_evaluate: 'can\'t evaluate' };

export function renderTimeline(trace) {
  const steps = trace.map((c) => `<div class="step ${TL_CLASS[c.status]}"><div class="dot"></div>
      <div class="shead"><span class="src plink" data-line="${c.src}">policies.md:${c.src}</span><span class="st">${TL_STATUS[c.status]}</span></div>
      <div class="ln"><span class="pfx">RULE</span><span class="val">${esc(c.rule)}</span></div>
      <div class="ln"><span class="pfx">EVIDENCE</span><span class="val">${esc(c.evidence)}</span></div>
    </div>`).join('');
  return `<div class="tl">${steps}
    <div class="step end"><div class="dot"></div><div class="concl">→ ${'conclusion below'}</div></div></div>`;
}

function contextTables(vm) {
  const c = vm.customer, t = vm.transaction, d = vm.display;
  const sh = (t && t.shipping) || null;
  const rows = (pairs) => pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join('');
  const custRows = rows([
    ['Name', `${d.customerName} · ${d.custId}`],
    ['Risk', d.riskScore],
    ['Lifetime', `${d.amountTextLifetime || ('$' + Number(d.lifetimeSpend).toFixed(2))} · ${c.lifetime_transactions} transactions`],
    ['Account', `since ${c.account_created}`],
    ['Disputes', `${c.disputes_filed} filed`],
  ]);
  const txnPairs = [
    ['Amount', d.amountText],
    ['Merchant', d.merchant],
    ['Purchased', `${(t.created_at || '').slice(0, 10)} (${d.ageDays}d ago)`],
  ];
  if (sh) txnPairs.push(['Carrier', sh.carrier], ['Status', sh.status], ['ETA', sh.estimated_delivery || '—'], ['Last scan', sh.last_location || '—']);
  return `<div class="ctxwrap">
    <div><h5>Customer</h5><table class="ctable">${custRows}</table></div>
    <div><h5>Transaction &amp; shipping</h5><table class="ctable">${rows(txnPairs)}</table></div>
  </div>`;
}

export function renderRail(decision) {
  const rec = decision.actions.recommended;
  const recBtn = rec
    ? `<div class="grp">Recommended</div>
       <button class="abtn rec-${rec.variant}" data-action="recommended">${esc(rec.label)}${rec.sub ? `<span class="sub">${esc(rec.sub)}</span>` : ''}</button>`
    : '<div class="grp">No recommended action — your call</div>';
  const others = decision.actions.others.map((a) =>
    `<button class="abtn ${a.danger ? 'danger' : ''}" data-action="other">${esc(a.label)}${a.sub ? `<span class="sub">${esc(a.sub)}</span>` : ''}</button>`).join('');
  const activity = (decision.activity || []).map((e) =>
    `<div class="ev"><span class="t">${esc(e.t)}</span><div class="d"><b>${esc(e.text)}</b><br><span class="who">${esc(e.who)}</span></div></div>`).join('');
  return `<div class="rail">
    <div class="dpanel"><div class="h">Decision · what you do</div><div class="body">
      ${recBtn}
      <div class="grp second">Other legal moves</div>
      ${others}
      <div class="logged">Every action writes an audit record — <b>who, when, action, reason, policy version</b>. policies.md:90</div>
    </div></div>
    <div class="sect"><h4 class="rail-h">Activity</h4><div class="act">${activity}</div></div>
  </div>`;
}

export function renderDetail(vm) {
  const d = vm.display, dec = vm.decision;
  const ref = dec.why.ref
    ? `<br><span class="ref">See ${policyLink(dec.why.ref)} for reference</span>` : '';
  const gap = dec.dataGap
    ? `<div class="datagap"><div class="t">DATA GAP</div><div class="b">${esc(dec.dataGap.text)}</div></div>` : '';
  const related = dec.related.length
    ? `Also open for this customer: ${dec.related.map(esc).join(', ')}.`
    : 'No other open tickets for this customer.';
  return `<div class="topbar"><a class="back" href="#" data-action="back">← Board</a></div>
  <div class="grid">
    <div class="main">
      <div class="thead">
        <div class="l1"><span class="ids">${esc(d.id)} · ${esc(d.txnId)}</span><span class="statuspill">${esc(dec.statusLabel)}</span></div>
        <div class="l2"><span class="type">${esc(dec.typeLabelOverride || d.typeLabel)}</span><span class="amt">${esc(d.amountText)}</span></div>
        <div><span class="sla">${esc(dec.urgency.label)}</span></div>
      </div>
      <div class="sect"><div class="rec ${dec.why.face}"><div class="lead">${esc(dec.why.lead)}</div>
        <div class="bc">${esc(dec.why.because)}${ref}</div></div></div>
      <div class="sect"><h4>How the agent reached this</h4>${renderTimeline(dec.trace)}${gap}</div>
      <hr class="rule">
      <div class="sect"><h4>Context</h4>${contextTables(vm)}</div>
      <hr class="rule">
      <div class="sect"><h4>Related</h4><div class="rel">${esc(related)}</div></div>
    </div>
    ${renderRail(dec)}
  </div>`;
}
