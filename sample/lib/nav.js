const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const VIEWS = [
  { view: 'agent',      icon: '🖥️', title: 'Virtual agent',  sub: 'pipeline monitor' },
  { view: 'operator',   icon: '📋', title: 'Operator board',  sub: 'for human review' },
  { view: 'specialist', icon: '🔎', title: 'Specialist board', sub: 'for fraud & escalations' },
];

export function renderPipelineNav(active) {
  const steps = VIEWS.map((v) =>
    `<div class="pstep ${v.view === active ? 'active' : ''}" data-view="${v.view}">
      <span class="pi">${v.icon}</span>
      <span class="ptxt"><span class="pt">${esc(v.title)}</span><span class="ps">${esc(v.sub)}</span></span>
    </div>`);
  return `<div class="pnav">${steps.join('<span class="arr">⟶</span>')}</div>`;
}
