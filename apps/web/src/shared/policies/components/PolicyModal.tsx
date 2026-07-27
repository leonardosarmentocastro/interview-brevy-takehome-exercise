"use client";
import { useAtom } from "jotai";
import { policyLineAtom } from "../data/atoms/policy-modal";
import { usePolicies } from "../hooks/use-policies";
import "../style.css";

export function PolicyModal() {
  const [line, setLine] = useAtom(policyLineAtom);
  const { data } = usePolicies();
  if (line === null) return null;
  const lines = data?.lines ?? [];
  const start = Math.max(1, line - 4);
  const end = Math.min(lines.length, line + 4);
  const window = [];
  for (let n = start; n <= end; n++) window.push({ n, text: lines[n - 1] ?? "" });
  return (
    <div className="polmodal">
      <div className="polbackdrop" data-testid="policy-backdrop" onClick={() => setLine(null)} />
      <div className="poldialog">
        <div className="polhead"><span>policies.md</span><button onClick={() => setLine(null)}>✕</button></div>
        <div className="polbody">
          {window.map(({ n, text }) => (
            <div key={n} className={`polline${n === line ? " hit" : ""}`}>
              <span className="ln">{n}</span><span>{text || "\u00a0"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
