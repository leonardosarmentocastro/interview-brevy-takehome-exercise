import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";
import { declineBody } from "@/modules/issues/__tests__/fixtures";

const seed = async () => (await ingestIssue(createIssueSchema.parse(declineBody)))!;

const params = {
  recommendation: "auto_resolve" as const,
  decision: "resolve" as const,
  target: "resolved" as const,
  band: "auto_execute" as const,
  reasoning: "Both conditions hold.",
  model: "claude-opus-5",
  confidence: 0.95,
  confidenceBase: 0.95,
  scoreBreakdown: { base: 0.95, penalties: [], caps: [], final: 0.95 },
  trace: [{ src: 78, rule: "r", status: "fired" as const, evidence: "e" }],
  reason: "agent resolved at 95%",
};

describe("applyAgentDecision", () => {
  it("writes the decision, the transition and the new status atomically", async () => {
    const issue = await seed();
    await issuesRepository.applyAgentDecision(issue, params);

    const { rows: issueRows } = await pool.query(
      "SELECT status FROM issues WHERE id = $1",
      [issue.id],
    );
    expect(issueRows[0].status).toBe("resolved");

    const { rows: decisions } = await pool.query(
      "SELECT * FROM issue_decisions WHERE issue_id = $1",
      [issue.id],
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      actor: "agent",
      decision: "resolve",
      recommendation: "auto_resolve",
      routing_band: "auto_execute",
      decided_by: "claude-opus-5",
    });
    expect(Number(decisions[0].confidence)).toBe(0.95);

    const { rows: history } = await pool.query(
      "SELECT to_status, actor, reason, decision_id FROM issue_status_history WHERE issue_id = $1 ORDER BY at",
      [issue.id],
    );
    expect(history.map((r) => r.to_status)).toEqual(["pending", "resolved"]);
    expect(history[1]).toMatchObject({ actor: "agent", reason: "agent resolved at 95%" });
    expect(history[1].decision_id).toBe(decisions[0].id);
  });

  it("links the transition to the decision so the audit trail joins up", async () => {
    const issue = await seed();
    await issuesRepository.applyAgentDecision(issue, params);

    const trail = await issuesRepository.getAuditTrail(issue.id);
    expect(trail.decisions).toHaveLength(1);
    expect(trail.timeline.map((e) => e.kind)).toContain("decision");
  });

  it("parks without a status change when the band withholds authority", async () => {
    // A capped decision still records everything the agent worked out; only
    // the authority to act is withheld.
    const issue = await seed();
    await issuesRepository.applyAgentDecision(issue, {
      ...params,
      recommendation: "auto_resolve",
      decision: "defer",
      target: "needs_review",
      band: "human_decision",
      confidence: 0.69,
      reason: "capped by policies.md:63",
    });

    const { rows } = await pool.query("SELECT status FROM issues WHERE id = $1", [
      issue.id,
    ]);
    expect(rows[0].status).toBe("needs_review");

    const { rows: decisions } = await pool.query(
      "SELECT recommendation, decision FROM issue_decisions WHERE issue_id = $1",
      [issue.id],
    );
    expect(decisions[0]).toMatchObject({
      recommendation: "auto_resolve",
      decision: "defer",
    });
  });
});

describe("listAwaitingAsyncReview", () => {
  it("returns issues the agent executed but flagged", async () => {
    const issue = await seed();
    await issuesRepository.applyAgentDecision(issue, {
      ...params,
      band: "execute_flagged",
      confidence: 0.73,
    });

    const awaiting = await issuesRepository.listAwaitingAsyncReview();
    expect(awaiting.map((i) => i.externalId)).toEqual(["iss_001"]);
  });

  it("ignores issues that auto-executed or were parked", async () => {
    const issue = await seed();
    await issuesRepository.applyAgentDecision(issue, params); // auto_execute

    expect(await issuesRepository.listAwaitingAsyncReview()).toEqual([]);
  });
});
