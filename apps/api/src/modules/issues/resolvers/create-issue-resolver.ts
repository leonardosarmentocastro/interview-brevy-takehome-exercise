import type { Request, Response, NextFunction } from "express";
import { createIssueSchema } from "@/modules/issues/schema";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { ConflictError } from "@/db/data/errors";

export const createIssueResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createIssueSchema.parse(req.body);
    const created = await ingestIssue(input);
    // ingestIssue treats a known issue as a no-op (the cron re-reads the same
    // feed constantly). Over HTTP a re-submission is still a client error.
    if (!created) {
      throw new ConflictError(
        `issue with external_id ${input.id} already exists`,
      );
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};
