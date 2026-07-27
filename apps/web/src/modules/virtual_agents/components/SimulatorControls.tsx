"use client";

import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import {
  pollAtom,
  leakAtom,
  nextAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";

type SimulatorControlsProps = {
  autoRun?: boolean;
};

export function SimulatorControls({ autoRun = true }: SimulatorControlsProps) {
  const poll = useSetAtom(pollAtom);
  const leak = useSetAtom(leakAtom);
  const next = useSetAtom(nextAtom);
  const budgetRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleAutoRun() {
    if (!autoRun) return;
    budgetRef.current = 5;
    const tick = () => {
      if (budgetRef.current <= 0) return;
      budgetRef.current -= 1;
      next();
      timerRef.current = setTimeout(tick, 1100);
    };
    tick();
  }

  function onPoll() {
    if (timerRef.current) clearTimeout(timerRef.current);
    poll();
    scheduleAutoRun();
  }

  return (
    <div className="sim">
      <div className="simh">⚡ Simulate intake (prototype)</div>
      <div className="simrow">
        <button type="button" className="simbtn" onClick={onPoll}>
          Poll vendor +5
        </button>
        <button type="button" className="simbtn leak" onClick={() => leak()}>
          Inject a leak
        </button>
      </div>
      <div className="simrow" style={{ marginTop: 6 }}>
        <button type="button" className="simbtn step" onClick={() => next()}>
          ▶ Process next
        </button>
      </div>
    </div>
  );
}
