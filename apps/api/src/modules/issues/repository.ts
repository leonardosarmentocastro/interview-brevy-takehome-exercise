import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  issues,
  issueDecisions,
  issueStatusHistory,
} from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import { isUniqueViolation } from "@/db/data/pg-errors";
import type { NewIssueRow } from "@/modules/issues/normalizer";
import type { ReviewDecision } from "@/modules/issues/state-machine";
import type {
  IssueRow,
  IssueStatus,
  DecisionRow,
  StatusHistoryRow,
} from "@/modules/issues/types";

export const issuesRepository = {
  async create(row: NewIssueRow): Promise<IssueRow> {
    try {
      return await db.transaction(async (tx) => {
        const [created] = await tx.insert(issues).values(row).returning();
        await tx.insert(issueStatusHistory).values({
          issueId: created.id,
          fromStatus: null,
          toStatus: "pending",
          actor: "system",
        });
        return created;
      });
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

  async listStatusHistory(issueId: string): Promise<StatusHistoryRow[]> {
    return db
      .select()
      .from(issueStatusHistory)
      .where(eq(issueStatusHistory.issueId, issueId))
      .orderBy(asc(issueStatusHistory.at));
  },

  async listDecisions(issueId: string): Promise<DecisionRow[]> {
    return db
      .select()
      .from(issueDecisions)
      .where(eq(issueDecisions.issueId, issueId))
      .orderBy(asc(issueDecisions.at));
  },

  // Atomic human review: write the decision, the status-history row (linked to
  // that decision), and flip the issue's status — all or nothing.
  async recordReview(
    issueId: string,
    params: {
      decision: ReviewDecision;
      target: IssueStatus;
      justification: string;
      reviewer: string;
      fromStatus: IssueStatus;
    },
  ): Promise<IssueRow> {
    return db.transaction(async (tx) => {
      const [decision] = await tx
        .insert(issueDecisions)
        .values({
          issueId,
          actor: "human",
          decision: params.decision,
          justification: params.justification,
          decidedBy: params.reviewer,
        })
        .returning();
      await tx.insert(issueStatusHistory).values({
        issueId,
        fromStatus: params.fromStatus,
        toStatus: params.target,
        actor: "human",
        decisionId: decision.id,
      });
      const [updated] = await tx
        .update(issues)
        .set({ status: params.target })
        .where(eq(issues.id, issueId))
        .returning();
      return updated;
    });
  },
};
