import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import {
  issues,
  issueDecisions,
  issueStatusHistory,
} from "@/modules/issues/model";
import type {
  AgentRecommendation,
  TraceNode,
} from "@/modules/issues/ai/agent/output-schema";
import type { AppliedVerb, RoutingBand } from "@/modules/issues/ai/routing";
import type { ScoreBreakdown } from "@/modules/issues/ai/confidence/score";
import type { NewIssueRow } from "@/modules/issues/ingestion/normalizer";
import type { ReviewDecision } from "@/modules/issues/state-machine";
import { mergeTimeline } from "@/modules/issues/timeline";
import type { TimelineEntry } from "@/modules/issues/timeline";
import type {
  IssueRow,
  IssueStatus,
  DecisionRow,
  StatusHistoryRow,
} from "@/modules/issues/types";

export type AuditTrail = {
  statusHistory: StatusHistoryRow[];
  decisions: DecisionRow[];
  timeline: TimelineEntry[];
};

export type AgentDecisionParams = {
  recommendation: AgentRecommendation;
  decision: AppliedVerb;
  target: IssueStatus;
  band: RoutingBand;
  reasoning: string;
  model: string;
  confidence: number;
  confidenceBase: number;
  scoreBreakdown: ScoreBreakdown;
  trace: TraceNode[];
  reason: string;
};

export const issuesRepository = {
  /**
   * Inserts an issue unless its `external_id` is already known, and records the
   * intake transition. Returns `null` when the issue was already present.
   *
   * Takes a caller-supplied transaction so the insert and the job enqueue
   * commit together — see `modules/issues/ingestion/ingest.ts`. Unlike
   * `create`, a duplicate is not an error here: re-reading the same upstream
   * feed is the normal case, not a fault.
   */
  async insertIfNew(tx: Tx, row: NewIssueRow): Promise<IssueRow | null> {
    const [created] = await tx
      .insert(issues)
      .values(row)
      .onConflictDoNothing({ target: issues.externalId })
      .returning();
    if (!created) return null;

    await tx.insert(issueStatusHistory).values({
      issueId: created.id,
      fromStatus: null,
      toStatus: "pending",
      actor: "system",
    });
    return created;
  },

  /**
   * Marks the start of processing. Idempotent: a retried job re-enters here
   * with the issue already `processing`, and the transition must stay a single
   * fact in the audit trail rather than gaining a row per retry.
   *
   * Note this is NOT a mutual-exclusion claim. Only one worker holds a given
   * job at a time — that is the job lease's guarantee, and using this update as
   * a lock instead would strand any issue whose worker died mid-job.
   */
  async beginProcessing(issue: IssueRow): Promise<void> {
    if (issue.status === "processing") return;

    await db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ status: "processing" })
        .where(eq(issues.id, issue.id));
      await tx.insert(issueStatusHistory).values({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: "processing",
        actor: "system",
      });
    });
  },

  /**
   * Hands the issue to a human, recording why.
   *
   * Both exits from the worker land here: the ordinary one (v1 has no decider,
   * so every issue needs a person) and the failure one (processing failed
   * permanently). No decision row is written — nothing has decided anything.
   */
  async parkForHumanReview(issue: IssueRow, reason: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ status: "needs_review" })
        .where(eq(issues.id, issue.id));
      await tx.insert(issueStatusHistory).values({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: "needs_review",
        actor: "system",
        reason,
      });
    });
  },

  /**
   * Atomic agent outcome: the decision, the linked status-history row, and the
   * new status — all or nothing.
   *
   * Mirrors `recordReview` deliberately. A human decision and an agent
   * decision are the same kind of fact with a different author, so they share
   * a shape and the audit trail joins them without special-casing either.
   *
   * `decision` is the verb actually applied while `recommendation` is what the
   * agent asked for. They diverge whenever a cap withholds authority, and
   * storing both is what makes that divergence auditable.
   */
  async applyAgentDecision(
    issue: IssueRow,
    params: AgentDecisionParams,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      const [decision] = await tx
        .insert(issueDecisions)
        .values({
          issueId: issue.id,
          actor: "agent",
          decision: params.decision,
          justification: params.reasoning,
          decidedBy: params.model,
          recommendation: params.recommendation,
          confidence: params.confidence,
          confidenceBase: params.confidenceBase,
          routingBand: params.band,
          scoreBreakdown: params.scoreBreakdown,
          trace: params.trace,
        })
        .returning();

      await tx.insert(issueStatusHistory).values({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: params.target,
        actor: "agent",
        reason: params.reason,
        decisionId: decision.id,
      });

      await tx
        .update(issues)
        .set({ status: params.target })
        .where(eq(issues.id, issue.id));
    });
  },

  /**
   * Issues the agent executed but flagged for a human to check after the fact
   * — the middle confidence band.
   *
   * Derived by joining the decision rather than denormalized onto `issues`.
   * At 10,000 issues/day this wants a flag column or a partial index; at this
   * volume a join is honest and keeps one source of truth.
   */
  async listAwaitingAsyncReview(): Promise<IssueRow[]> {
    const rows = await db
      .select({ issue: issues })
      .from(issues)
      .innerJoin(issueDecisions, eq(issueDecisions.issueId, issues.id))
      .where(
        and(
          eq(issueDecisions.actor, "agent"),
          eq(issueDecisions.routingBand, "execute_flagged"),
        ),
      )
      .orderBy(desc(issues.ingestedAt));
    return rows.map((r) => r.issue);
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

  // The full read-side audit trail for an issue: the raw status-history and
  // decision rows plus the derived chronological timeline. Kept in one method
  // so any caller (get-issue today, a list view tomorrow) assembles it the
  // same way instead of re-orchestrating the two queries + merge.
  async getAuditTrail(issueId: string): Promise<AuditTrail> {
    const [statusHistory, decisions] = await Promise.all([
      db
        .select()
        .from(issueStatusHistory)
        .where(eq(issueStatusHistory.issueId, issueId))
        .orderBy(asc(issueStatusHistory.at)),
      db
        .select()
        .from(issueDecisions)
        .where(eq(issueDecisions.issueId, issueId))
        .orderBy(asc(issueDecisions.at)),
    ]);
    return {
      statusHistory,
      decisions,
      timeline: mergeTimeline(statusHistory, decisions),
    };
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
