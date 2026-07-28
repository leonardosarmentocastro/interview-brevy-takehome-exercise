import type { Request, Response, NextFunction } from "express";
import { createIssueSchema } from "@/modules/issues/schema";
import { toIssueRow } from "@/modules/issues/normalizer";
import { issuesRepository } from "@/modules/issues/repository";

export const createIssueResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createIssueSchema.parse(req.body);
    const created = await issuesRepository.create(toIssueRow(input));
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};
