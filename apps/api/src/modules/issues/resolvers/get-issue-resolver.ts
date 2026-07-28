import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
import { NotFoundError } from "@/db/data/errors";

export const getIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const found = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!found) throw new NotFoundError(`issue ${req.params.id} not found`);
    res.status(200).json(found);
  } catch (err) {
    next(err);
  }
};
