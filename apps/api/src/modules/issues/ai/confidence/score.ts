import type { AgentDecision } from "@/modules/issues/ai/agent/output-schema";
import { capsFor, ceilingOf, type Cap } from "@/modules/issues/ai/confidence/caps";
import type { IssueRow } from "@/modules/issues/types";

export type Penalty = { reason: string; amount: number };

export type ScoreBreakdown = {
  base: number;
  penalties: Penalty[];
  caps: Cap[];
  final: number;
};

/** Verification failure is not a low score — it is no score. See decide.ts. */
export const VERIFICATION_FAILED_SCORE = 0;

// Bands are 20 points wide, so 0.15 is meaningful without automatically
// dropping a band, while two unevaluable rules always do. One gap is
// tolerable; compounding gaps are not.
//
// These magnitudes are judgment calls, not empirical. The defensible part is
// that they live here as named constants with a test per rule, so calibrating
// them is a data edit. Real calibration comes from shadow mode — measured
// agent-vs-human agreement — which this cycle does not build.
const PENALTY = {
  cantEvaluate: 0.15,
  dataGap: 0.1,
} as const;

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Confidence composes as `clamp(base − penalties, 0, min(caps))`.
 *
 * The model owns the base; deterministic code owns the ceiling and can only
 * subtract. The layers are ORDERED, not weighted — a weighted blend would let
 * a confident model dilute a hard safety rule, which is exactly the failure
 * this design exists to prevent.
 *
 * The number is not "probability the recommendation is correct" (not
 * calibratable from one sample). It answers: how much of this verdict rests
 * on things we could independently check?
 */
export const score = (
  decision: AgentDecision,
  issue: IssueRow,
): ScoreBreakdown => {
  const penalties: Penalty[] = decision.trace
    .filter((node) => node.status === "cant_evaluate")
    .map((node) => ({
      reason: `trace node :${node.src} cant_evaluate`,
      amount: PENALTY.cantEvaluate,
    }));

  if (decision.dataGap) {
    penalties.push({ reason: "data gap declared", amount: PENALTY.dataGap });
  }

  const caps = capsFor(issue);
  const deducted = penalties.reduce((sum, p) => sum + p.amount, 0);
  const adjusted = decision.confidence - deducted;
  const final = Math.min(Math.max(adjusted, 0), ceilingOf(caps));

  return {
    base: decision.confidence,
    penalties,
    caps,
    final: round3(final),
  };
};
