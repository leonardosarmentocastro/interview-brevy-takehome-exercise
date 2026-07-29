import type { Request, Response, NextFunction } from "express";
import { reviewIssueSchema } from "@/modules/issues/schema";
import { nextStatusFor } from "@/modules/issues/state-machine";
import { issuesRepository } from "@/modules/issues/repository";
import { ConflictError, NotFoundError } from "@/db/data/errors";

export const reviewIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = reviewIssueSchema.parse(req.body);
    const issue = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!issue) throw new NotFoundError(`issue ${req.params.id} not found`);

    const target = nextStatusFor(issue.status, input.decision);
    if (!target) {
      throw new ConflictError(
        `cannot ${input.decision} an issue in status ${issue.status}`,
      );
    }

    const updated = await issuesRepository.recordReview(issue.id, {
      decision: input.decision,
      target,
      justification: input.justification,
      reviewer: input.reviewer,
      fromStatus: issue.status,
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
