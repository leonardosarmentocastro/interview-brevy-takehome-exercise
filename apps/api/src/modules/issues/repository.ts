import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import { isUniqueViolation } from "@/db/data/pg-errors";
import type { NewIssueRow } from "@/modules/issues/normalizer";
import type { IssueRow, IssueStatus } from "@/modules/issues/types";

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

  async list(filters?: { statuses?: IssueStatus[] }): Promise<IssueRow[]> {
    // `.where(undefined)` is a drizzle no-op, so an absent/empty filter lists all.
    const where = filters?.statuses?.length
      ? inArray(issues.status, filters.statuses)
      : undefined;
    return db
      .select()
      .from(issues)
      .where(where)
      .orderBy(desc(issues.ingestedAt));
  },

  async findByIdOrExternalId(
    idOrExternalId: string,
  ): Promise<IssueRow | undefined> {
    // A uuid-shaped param is our PK; anything else is the upstream external_id.
    // We must branch BEFORE querying: comparing a non-uuid value against the
    // uuid `id` column makes Postgres raise an invalid-input-syntax error.
    const isUuid = z.uuid().safeParse(idOrExternalId).success;
    const where = isUuid
      ? eq(issues.id, idOrExternalId)
      : eq(issues.externalId, idOrExternalId);
    const [found] = await db.select().from(issues).where(where);
    return found;
  },
};
