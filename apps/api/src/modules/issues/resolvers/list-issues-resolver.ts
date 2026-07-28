import type { Request, Response, NextFunction } from "express";
import { listIssuesQuerySchema } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";

export const listIssuesResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status } = listIssuesQuerySchema.parse(req.query);
    res.status(200).json(await issuesRepository.list({ statuses: status }));
  } catch (err) {
    next(err);
  }
};
