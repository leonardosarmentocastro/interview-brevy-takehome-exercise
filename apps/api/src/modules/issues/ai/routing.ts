import type { AgentRecommendation } from "@/modules/issues/ai/agent/output-schema";
import type { IssueStatus } from "@/modules/issues/types";

export type RoutingBand = "auto_execute" | "execute_flagged" | "human_decision";

/**
 * The verb written to `issue_decisions.decision`.
 *
 * `defer` is the agent-only verb: a decision was reached and recorded, but no
 * authority was exercised. Human verbs stay resolve/escalate/hold — see
 * state-machine.ts.
 */
export type AppliedVerb = "resolve" | "escalate" | "defer";

export type RoutedOutcome = {
  band: RoutingBand;
  status: IssueStatus;
  decision: AppliedVerb;
};

const AUTO_EXECUTE_FLOOR = 0.9;
const FLAGGED_FLOOR = 0.7;

export const bandFor = (confidence: number): RoutingBand => {
  if (confidence >= AUTO_EXECUTE_FLOOR) return "auto_execute";
  if (confidence >= FLAGGED_FLOOR) return "execute_flagged";
  return "human_decision";
};

const EXECUTED: Record<AgentRecommendation, Omit<RoutedOutcome, "band">> = {
  auto_resolve: { status: "resolved", decision: "resolve" },
  escalate: { status: "escalated", decision: "escalate" },
  // Executing "get a human" is parking. The recommendation is carried out,
  // not overridden.
  human_review: { status: "needs_review", decision: "defer" },
};

/**
 * Confidence decides WHO acts; the recommendation decides WHAT happens.
 *
 * Below the human-decision floor the two diverge on purpose: the agent may
 * still recommend `auto_resolve`, but the issue parks with that recommendation
 * attached, so the reviewer inherits completed reasoning and supplies only the
 * authority.
 */
export const route = (
  recommendation: AgentRecommendation,
  confidence: number,
): RoutedOutcome => {
  const band = bandFor(confidence);
  if (band === "human_decision") {
    return { band, status: "needs_review", decision: "defer" };
  }
  return { band, ...EXECUTED[recommendation] };
};
