import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import type { NewIssueRow } from "@/modules/issues/normalizer";
import type { IssueRow } from "@/modules/issues/types";

const UNIQUE_VIOLATION = "23505"; // Postgres error code for unique constraint

// drizzle-orm wraps driver failures in a DrizzleQueryError, keeping the raw
// `pg` DatabaseError (which carries `.code`) on `.cause`. Check both so a
// unique-violation is detected regardless of wrapping.
const isUniqueViolation = (err: unknown): boolean => {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
};

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
