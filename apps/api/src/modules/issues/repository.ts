import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import { isUniqueViolation } from "@/db/data/pg-errors";
import type { NewIssueRow } from "@/modules/issues/normalizer";
import type { IssueRow } from "@/modules/issues/types";

export const issuesRepository = {
  async create(row: NewIssueRow): Promise<IssueRow> {
    try {
      const [created] = await db.insert(issues).values(row).returning();
      return created;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          `issue with external_id ${row.externalId} already exists`,
        );
      }
      throw err;
    }
  },

  async list(): Promise<IssueRow[]> {
    return db.select().from(issues).orderBy(desc(issues.ingestedAt));
  },
};
