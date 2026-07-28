import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
import { mergeTimeline } from "@/modules/issues/timeline";
import type { DecisionRow, StatusHistoryRow } from "@/modules/issues/types";
import { NotFoundError } from "@/db/data/errors";

// Drizzle returns rows keyed by the model's camelCase property names; the wire
// contract for the embedded audit trail is snake_case. Serialize at the boundary
// (the timeline is still derived from the raw camelCase rows above).
const toStatusHistoryWire = (h: StatusHistoryRow) => ({
  id: h.id,
  issue_id: h.issueId,
  from_status: h.fromStatus,
  to_status: h.toStatus,
  actor: h.actor,
  decision_id: h.decisionId,
  at: h.at,
});

const toDecisionWire = (d: DecisionRow) => ({
  id: d.id,
  issue_id: d.issueId,
  actor: d.actor,
  decision: d.decision,
  justification: d.justification,
  decided_by: d.decidedBy,
  at: d.at,
});

export const getIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const issue = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!issue) throw new NotFoundError(`issue ${req.params.id} not found`);
    const [statusHistory, decisions] = await Promise.all([
      issuesRepository.listStatusHistory(issue.id),
      issuesRepository.listDecisions(issue.id),
    ]);
    res.status(200).json({
      ...issue,
      status_history: statusHistory.map(toStatusHistoryWire),
      decisions: decisions.map(toDecisionWire),
      timeline: mergeTimeline(statusHistory, decisions),
    });
  } catch (err) {
    next(err);
  }
};
