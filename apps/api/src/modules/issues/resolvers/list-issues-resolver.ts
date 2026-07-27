import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";

export const listIssuesResolver = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await issuesRepository.list());
  } catch (err) {
    next(err);
  }
};
