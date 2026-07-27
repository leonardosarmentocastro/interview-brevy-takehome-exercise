"use client";
import { useSetAtom } from "jotai";
import { policyLineAtom } from "../data/atoms/policy-modal";
import "../style.css";

export function PolicyLink({ line }: { line: number }) {
  const setLine = useSetAtom(policyLineAtom);
  return (
    <button type="button" className="plink" onClick={() => setLine(line)}>
      policies.md:{line}
    </button>
  );
}
