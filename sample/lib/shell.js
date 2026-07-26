const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEADERS = {
  agent:      { layer: 1, title: 'Virtual agent — pipeline monitor' },
  operator:   { layer: 2, title: 'Operator board — for human review' },
  specialist: { layer: 3, title: 'Specialist board — for fraud & escalations' },
};

export function renderAppHeader(view) {
  const h = HEADERS[view] || HEADERS.agent;
  return `<div class="appbar">
    <div class="ttl"><span class="eyebrow">Pipeline · layer ${h.layer} of 3</span><h2>${esc(h.title)}</h2></div>
    <div class="spacer"></div>
    <button class="idchip" data-action="switch-role" aria-label="Switch role">
      <span class="ava">ADM</span>
      <span class="who"><span class="r">Admin</span><span class="h">switch role</span></span>
      <span class="car">▾</span>
    </button>
  </div>`;
}

const ROLES = [
  { enabled: true,  name: 'Admin',      mgr: '',          avatar: 'A',
    scope: 'Full visibility across all three pipeline layers — virtual agent, operator & specialist.' },
  { enabled: false, name: 'Specialist', mgr: ' / manager', avatar: '🔒',
    scope: 'Sees the specialist board. Manager sees across all specialists.' },
  { enabled: false, name: 'Operator',   mgr: ' / manager', avatar: '🔒',
    scope: 'Sees only their own operator board. Manager sees across all operators.' },
];

function roleRow(r) {
  const cls = r.enabled ? 'role admin' : 'role off';
  const hook = r.enabled ? ' data-action="pick-role" data-role="admin"' : '';
  const right = r.enabled ? '<span class="cont">Continue&nbsp;→</span>' : '<span class="rtag">requires auth</span>';
  return `<div class="${cls}"${hook}>
    <div class="rava">${r.avatar}</div>
    <div class="rbody"><div class="rname">${esc(r.name)}<span class="mgr">${esc(r.mgr)}</span></div>
      <div class="rscope">${esc(r.scope)}</div></div>
    ${right}
  </div>`;
}

export function renderRoleModal() {
  return `<div class="overlay hidden" id="roleModal">
    <div class="modal">
      <div class="mh"><span class="dot"></span><span class="brand">PAYMENT ISSUE CONSOLE</span></div>
      <div class="mtitle">Who's operating the console?</div>
      <p class="mnote">Authentication isn't wired in this MVP — <code>pick a role to continue</code>.</p>
      ${ROLES.map(roleRow).join('')}
      <div class="mfoot">Only <b>Admin</b> is enabled in this build.</div>
    </div>
  </div>`;
}
