import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
import { mergeTimeline } from "@/modules/issues/timeline";
import { NotFoundError } from "@/db/data/errors";

// Drizzle returns rows keyed by the model's camelCase property names, and that
// camelCase is the wire contract end-to-end — issue fields and the embedded
// audit trail alike — so rows are serialized as-is (no snake_case remapping).
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
      statusHistory,
      decisions,
      timeline: mergeTimeline(statusHistory, decisions),
    });
  } catch (err) {
    next(err);
  }
};
