import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { issuesRepository } from "@/modules/issues/repository";
import { createIssueSchema } from "@/modules/issues/schema";
import { declineBody } from "@/modules/issues/__tests__/fixtures";

const seed = () => ingestIssue(createIssueSchema.parse(declineBody));

const historyOf = async (issueId: string) =>
  (
    await pool.query(
      "SELECT from_status, to_status, actor FROM issue_status_history WHERE issue_id = $1 ORDER BY at",
      [issueId],
    )
  ).rows;

describe("beginProcessing", () => {
  it("moves a pending issue to processing and records it", async () => {
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("processing");
    expect(await historyOf(issue.id)).toEqual([
      { from_status: null, to_status: "pending", actor: "system" },
      { from_status: "pending", to_status: "processing", actor: "system" },
    ]);
  });

  it("records nothing when the issue is already processing", async () => {
    // A retried job re-enters here. The transition is a fact that happened
    // once, so it must be logged once — otherwise the audit trail grows a
    // duplicate row for every retry.
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);
    await issuesRepository.beginProcessing({ ...issue, status: "processing" });

    expect(await historyOf(issue.id)).toHaveLength(2);
  });
});

describe("parkForHumanReview", () => {
  it("moves the issue to needs_review with the reason recorded", async () => {
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);
    await issuesRepository.parkForHumanReview(
      { ...issue, status: "processing" },
      "awaiting human decision",
    );

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("needs_review");

    const [last] = (
      await pool.query(
        "SELECT to_status, actor, reason FROM issue_status_history WHERE issue_id = $1 ORDER BY at DESC LIMIT 1",
        [issue.id],
      )
    ).rows;
    expect(last).toEqual({
      to_status: "needs_review",
      actor: "system",
      reason: "awaiting human decision",
    });
  });

  it("writes no decision row — v1 has no decider", async () => {
    const issue = (await seed())!;
    await issuesRepository.parkForHumanReview(issue, "awaiting human decision");

    const { rows } = await pool.query("SELECT id FROM issue_decisions");
    expect(rows).toEqual([]);
  });
});
