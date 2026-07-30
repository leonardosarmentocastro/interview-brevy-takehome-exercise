import type { IssueStatus } from "@/modules/issues/types";

// The verbs POST /issues/:id/review accepts. Single source of truth — the Zod
// schema derives its enum from this tuple.
export const REVIEW_DECISIONS = ["resolve", "escalate", "hold"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

type Rule = { target: IssueStatus; from: IssueStatus[] };

// The human-review transition map. pending is never here (a review needs a first
// machine or agent verdict); resolved is terminal (never a legal `from`).
// needs_review is where the worker parks an issue it cannot decide — the
// primary lane a human reviews from.
const TRANSITIONS: Record<ReviewDecision, Rule> = {
  resolve: {
    target: "resolved",
    from: ["processing", "needs_review", "on_hold", "escalated"],
  },
  escalate: {
    target: "escalated",
    from: ["processing", "needs_review", "on_hold"],
  },
  hold: {
    target: "on_hold",
    from: ["processing", "needs_review", "escalated"],
  },
};

// Target status for a legal (current, decision) pair, else null (illegal → 409).
export const nextStatusFor = (
  current: IssueStatus,
  decision: ReviewDecision,
): IssueStatus | null => {
  const rule = TRANSITIONS[decision];
  return rule.from.includes(current) ? rule.target : null;
};
