import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
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
    const auditTrail = await issuesRepository.getAuditTrail(issue.id);
    res.status(200).json({ ...issue, ...auditTrail });
  } catch (err) {
    next(err);
  }
};
