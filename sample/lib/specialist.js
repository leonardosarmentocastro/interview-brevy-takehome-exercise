import { policyLink } from './render.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BAR_ICON = { act: '⚠', breach: '⚠', reval: '⟳' };

export function renderUrgencyBar(bar, crit = 'high') {
  if (!bar) return '';
  const isBreach = bar.kind === 'breach';
  // fill colour follows the card's criticality tier (crit→red, high→amber, mod→grey); breach fills solid red
  const fill = isBreach ? 'ufil full' : `ufil ${crit}`;
  const elapsed = bar.elapsed ? `<span class="uel">${esc(bar.elapsed)}</span>` : '';
  const endClass = isBreach ? 'uend breach' : 'uend';
  const width = isBreach ? '100%' : `${bar.fillPct}%`;
  return `<div class="ubar"><div class="utrk"><div class="${fill}" style="width:${width}">${elapsed}<span class="uedge"></span></div></div>
    <div class="${endClass}"><span class="mk">${BAR_ICON[bar.kind]}</span><span class="wd">${esc(bar.word)}</span><span>· ${esc(bar.limit)}</span></div></div>`;
}

function provLine(prov) {
  const verb = prov.mode === 'auto' ? 'automatically escalated' : 'manually escalated';
  const who = prov.mode === 'auto' ? 'by agent' : 'by operator';
  return `<div class="prov">↑ <b>${verb}</b> ${who} · ${esc(prov.reason)} · ${policyLink(prov.ref)}</div>`;
}

export function renderSpecialistCard(c, opts = {}) {
  const breach = c.breach ? ' breach' : '';
  const bump = c.breach ? '<span class="bump">⤒ bumped to top</span>' : '';
  const hv = c.highValue ? '<span class="rtag hv">high-value</span>' : '';
  const owner = c.owner ? `<span class="own">${opts.resolved ? '✓' : '🔒'} you</span>` : '';
  const tags = `<div class="tags"><span class="crt ${c.crit}">${esc(c.tier)}</span>${hv}${owner}</div>`;
  const mid = opts.resolved
    ? `<div class="outcome">${c.outcome}</div>`
    : renderUrgencyBar(c.bar, c.crit);
  const prov = opts.resolved ? '' : provLine(c.prov);
  const acts = opts.claimed || opts.resolved
    ? `<div class="cardacts"><button class="cbtn" data-action="open-case" data-id="${esc(c.id)}">Open ticket</button></div>`
    : `<div class="cardacts"><button class="cbtn" data-action="open-case" data-id="${esc(c.id)}">Open ticket</button><button class="cbtn claim" data-action="claim" data-id="${esc(c.id)}">Claim</button></div>`;
  return `<div class="tk c-${c.crit}${breach}" data-case="${esc(c.id)}">${bump}
    <div class="t1"><b>${esc(c.type)}</b><span class="amt">${esc(c.amountText)}</span></div>
    <div class="t2">${esc(c.meta)}</div>
    ${tags}
    ${mid}
    ${opts.resolved ? '' : prov}
    ${acts}
  </div>`;
}

const CHIPS = [
  { cat: 'all', label: 'All' },
  { cat: 'fraud', label: 'Fraud' },
  { cat: 'dispute', label: 'Disputes > $200' },
  { cat: 'retry', label: 'Exhausted retries' },
  { cat: 'highvalue', label: 'High-value' },
];

export function renderSpecialistToolbar() {
  const chips = CHIPS.map((c, i) =>
    `<span class="chip ${i === 0 ? 'on' : ''}" data-cat="${c.cat}" data-action="sb-chip">${esc(c.label)}</span>`).join('');
  return `<div class="sbtools">
    <span class="tlbl">Sort</span><span class="sortsel">Criticality → Urgency ▾</span>
    <div class="chips">${chips}</div>
    <input class="search sbsearch" id="sbq" placeholder="🔎 id / customer / merchant" data-action="sb-search">
  </div>`;
}

function laneCards(cards, opts) {
  return cards.length ? cards.map((c) => renderSpecialistCard(c, opts)).join('')
    : '<div class="empty">Nothing here</div>';
}

export function renderSpecialistBoard(s) {
  const queue = s.queue.map((c) => renderSpecialistCard(c, {})).join('');
  return `${renderSpecialistToolbar()}
  <div class="boardarea">
    <div class="twozone">
      <div class="zone team">
        <div class="zhead"><span class="lbl">Escalation queue</span><span class="exp">Unassigned — any specialist can claim these · <span class="online">${s.online} online</span></span></div>
        <div class="col shared sbcol">
          <div class="col-h"><h4>Needs investigation</h4><span class="n">${s.queue.length}</span></div>
          <p class="col-note">${esc(s.breakdown)} — claim one to lock it to you &amp; leave others' view.</p>
          <div class="cards" id="sb-queue">${queue}</div>
        </div>
      </div>
      <div class="zone mine">
        <div class="zhead"><span class="lbl">◧ My work</span><span class="exp">Cases you claimed (Sam) — only you see &amp; act on these.</span></div>
        <div class="lanes">
          <div class="col sbcol">
            <div class="col-h"><h4>Investigating</h4><span class="n">${s.mine.investigating.length}</span></div>
            <p class="col-note">Actively working now.</p>
            <div class="cards" id="sb-investigating">${laneCards(s.mine.investigating, { claimed: true })}</div>
          </div>
          <div class="col sbcol">
            <div class="col-h"><h4>On hold</h4><span class="n">${s.mine.onhold.length}</span></div>
            <p class="col-note">Awaiting an external party (bank / carrier / customer).</p>
            <div class="cards" id="sb-onhold">${laneCards(s.mine.onhold, { claimed: true })}</div>
          </div>
          <div class="col sbcol">
            <div class="col-h"><h4>Resolved</h4><span class="n">${s.mine.resolved.length}</span></div>
            <p class="col-note">Closed by you — terminal.</p>
            <div class="cards" id="sb-resolved">${laneCards(s.mine.resolved, { resolved: true })}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// resolve REF<nn> placeholders in trusted authored HTML into real policy links
const resolveRefs = (html) => String(html).replace(/REF(\d+)/g, (_, n) => policyLink(Number(n)));

export function renderCaseHistory(nodes) {
  const steps = nodes.map((n) => {
    if (n.end) {
      return `<div class="step end ${n.endCrit}"><div class="dot"></div>
        <div class="shead"><span class="actor you">${esc(n.actor)}</span></div>
        <div class="concl">${esc(n.concl)}</div></div>`;
    }
    const badge = `<span class="actor ${n.actorClass}">${esc(n.actor)}</span>`;
    const meta = n.ref
      ? `${badge}${policyLink(n.ref)}<span class="st">${esc(n.st)}</span>`
      : `${badge}<span class="st">${esc(n.when || '')}</span>`;
    const body = n.rows
      ? n.rows.map(([p, v]) => `<div class="ln"><span class="pfx">${esc(p)}</span><span class="val">${v}</span></div>`).join('')
      : `<div class="ln"><span class="val">${esc(n.line)}</span></div>`;
    const note = n.note ? `<div class="note">${esc(n.note)}</div>` : '';
    return `<div class="step ${n.fired ? 'f' : ''}"><div class="dot"></div>
      <div class="shead">${meta}</div>${body}${note}</div>`;
  }).join('');
  return `<div class="tl">${steps}</div>`;
}

function railBtn(b) {
  const cls = b.variant === 'esc' ? 'abtn rec-esc' : b.variant === 'go' ? 'abtn rec-go' : 'abtn';
  const action = b.variant ? 'recommended' : 'other';
  return `<button class="${cls}" data-action="${action}">${esc(b.label)}<span class="sub">${esc(b.sub)}</span></button>`;
}

function ctxTable(t) {
  const rows = t.rows.map((r) => {
    const [k, v, missing] = r;
    return `<tr><td class="k">${esc(k)}</td><td class="v${missing ? ' missing' : ''}">${esc(v)}</td></tr>`;
  }).join('');
  return `<div><div class="grp">${esc(t.title)}</div><table class="ctable">${rows}</table></div>`;
}

export function renderCaseView(c) {
  const provLead = c.prov.mode === 'auto' ? '↑ AUTOMATICALLY ESCALATED BY AGENT' : '↑ MANUALLY ESCALATED BY OPERATOR';
  const staged = c.dataGap.staged ? `<div class="staged">${esc(c.dataGap.staged)}</div>` : '';
  const resolve = c.rail.resolve.map(railBtn).join('');
  const other = c.rail.other.map(railBtn).join('');
  return `<div class="topbar"><a class="back" data-action="sb-back">← Board</a>
      <span class="path">Specialist board / <b>${esc(c.id)} · ${esc(c.type)}</b></span></div>
  <div class="grid">
    <div class="main">
      <div class="thead">
        <div class="l1"><span class="ids">${esc(c.id)} · ${esc(c.txnId)}</span><span class="statuspill">${esc(c.status)}</span></div>
        <div class="l2"><span class="type">${esc(c.type)}</span><span class="amt">${esc(c.amountText)}</span></div>
        <div class="l1"><span class="crt ${c.crit}">${esc(c.tier)}</span></div>
        ${renderUrgencyBar(c.bar, c.crit)}
      </div>
      <div class="prov-b"><div class="lead">${esc(provLead)}</div><div class="bc">${resolveRefs(c.prov.because)}</div></div>
      <div><h4 class="sh">Case history — agent → ${c.prov.mode === 'auto' ? 'you' : 'operator → you'}</h4>${renderCaseHistory(c.history)}</div>
      <div class="datagap"><div class="t">⚠ DATA GAP</div><div class="b">${resolveRefs(c.dataGap.html)}</div>${staged}</div>
      <hr class="rule">
      <div><h4 class="sh">Context</h4><div class="ctxwrap">${ctxTable(c.context.left)}${ctxTable(c.context.right)}</div></div>
      <hr class="rule">
      <div><h4 class="sh">Related</h4><div class="rel">${esc(c.related)}</div></div>
    </div>
    <div class="rail">
      <div class="dpanel"><div class="h">Terminal decision</div><div class="body">
        <div class="grp">Resolve</div>
        ${resolve}
        <div class="grp second">Other moves</div>
        ${other}
        <div class="logged"><b>Writes to the audit log:</b> who (Sam), when, action, reason, policy version. Every terminal action captures a reason before it commits (${policyLink(90)}).</div>
      </div></div>
      <div class="terminal-note">${esc(c.terminalNote)}</div>
    </div>
  </div>`;
}

export const renderSpecialistCardClaimed = (c) => renderSpecialistCard(c, { claimed: true });
