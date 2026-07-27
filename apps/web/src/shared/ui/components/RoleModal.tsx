"use client";

const ROLES = [
  { enabled: true, name: "Admin", mgr: "", avatar: "A", scope: "Full visibility across all three pipeline layers — virtual agent, operator & specialist." },
  { enabled: false, name: "Specialist", mgr: " / manager", avatar: "🔒", scope: "Sees the specialist board. Manager sees across all specialists." },
  { enabled: false, name: "Operator", mgr: " / manager", avatar: "🔒", scope: "Sees only their own operator board. Manager sees across all operators." },
];

export function RoleModal({ open, onPick }: { open: boolean; onPick: (role: "admin") => void }) {
  if (!open) return null;
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mh"><span className="dot" /><span className="brand">PAYMENT ISSUE CONSOLE</span></div>
        <div className="mtitle">Who&apos;s operating the console?</div>
        <p className="mnote">Authentication isn&apos;t wired in this MVP — <code>pick a role to continue</code>.</p>
        {ROLES.map((r) => (
          <div
            key={r.name}
            className={r.enabled ? "role admin" : "role off"}
            onClick={r.enabled ? () => onPick("admin") : undefined}
          >
            <div className="rava">{r.avatar}</div>
            <div className="rbody">
              <div className="rname">{r.name}<span className="mgr">{r.mgr}</span></div>
              <div className="rscope">{r.scope}</div>
            </div>
            {r.enabled
              ? <span className="cont">Continue&nbsp;→</span>
              : <span className="rtag">requires auth</span>}
          </div>
        ))}
        <div className="mfoot">Only <b>Admin</b> is enabled in this build.</div>
      </div>
    </div>
  );
}
