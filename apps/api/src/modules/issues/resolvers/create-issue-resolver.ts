import type { Request, Response, NextFunction } from "express";
import { createIssueSchema, toIssueRow } from "@/modules/issues/schema";
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
