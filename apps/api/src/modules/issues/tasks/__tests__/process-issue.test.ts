import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { processIssue } from "@/modules/issues/tasks/process-issue";
import { declineBody } from "@/modules/issues/__tests__/fixtures";
import { TerminalError } from "@/queue/retry-policy";

const seed = async () =>
  (await ingestIssue(createIssueSchema.parse(declineBody)))!;

// The worker calls tasks with a rich `helpers`; the handler needs only these
// two fields, so tests supply them directly. No runner, no timers, no flake.
const helpers = (attempts: number) => ({ job: { attempts } });

const statusOf = async (issueId: string) =>
  (await pool.query("SELECT status FROM issues WHERE id = $1", [issueId]))
    .rows[0].status;

const historyOf = async (issueId: string) =>
  (
    await pool.query(
      "SELECT to_status, reason FROM issue_status_history WHERE issue_id = $1 ORDER BY at",
      [issueId],
    )
  ).rows;

beforeEach(() => {
  // These tests cover the queue's mechanics — leases, retries, the entry
  // guard — not the agent's judgement. Stub mode keeps them offline and
  // deterministic; the agent path is exercised below with an injected decider.
  process.env.DECIDE_MODE = "stub";
});

afterEach(() => {
  delete process.env.DECIDE_MODE;
});

describe("processIssue", () => {
  it("takes a pending issue through processing and parks it for a human", async () => {
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1));

    expect(await statusOf(issue.id)).toBe("needs_review");
    expect((await historyOf(issue.id)).map((r) => r.to_status)).toEqual([
      "pending",
      "processing",
      "needs_review",
    ]);
  });

  it("does nothing when the issue has already left the queue", async () => {
    // The crash-after-commit window: the outcome committed, then the process
    // died before the job was marked done, so the job is retried against
    // finished work. Without the entry guard the issue is decided twice.
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1));
    const before = await historyOf(issue.id);

    await processIssue({ issueId: issue.id }, helpers(2));

    expect(await historyOf(issue.id)).toEqual(before);
  });

  it("does nothing when the issue no longer exists", async () => {
    await expect(
      processIssue(
        { issueId: "00000000-0000-0000-0000-000000000009" },
        helpers(1),
      ),
    ).resolves.toBeUndefined();
  });

  it("rethrows a retryable failure mid-budget so the queue backs off", async () => {
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_retryable";

    await expect(
      processIssue({ issueId: issue.id }, helpers(3)),
    ).rejects.toThrow();

    // Critically: still `processing`, NOT parked. The issue is not abandoned,
    // and the next attempt will re-enter cleanly.
    expect(await statusOf(issue.id)).toBe("processing");
  });

  it("parks the issue instead of throwing on the final attempt", async () => {
    // Graphile Worker has no "fail permanently now" signal — throwing always
    // means retry. So the only way to reach a terminal outcome is to NOT throw:
    // swallow, park the issue where an operator sees it, report success. A
    // failed job row is something nobody looks at; the human lane gets worked.
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_retryable";

    await expect(
      processIssue({ issueId: issue.id }, helpers(8)),
    ).resolves.toBeUndefined();

    expect(await statusOf(issue.id)).toBe("needs_review");
    const last = (await historyOf(issue.id)).at(-1);
    expect(last.reason).toMatch(/permanently/i);
  });

  it("parks the issue on the first attempt for a terminal failure", async () => {
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_terminal";

    await expect(
      processIssue({ issueId: issue.id }, helpers(1)),
    ).resolves.toBeUndefined();

    expect(await statusOf(issue.id)).toBe("needs_review");
  });

  it("rethrows on abort so a killed worker's job can resume", async () => {
    // SIGTERM aborts in-flight decide() work. That must NOT park the issue —
    // the lease should release and a restarted worker resume. Abort is not a
    // permanent failure.
    const issue = await seed();
    process.env.DECIDE_MODE = "slow";
    const controller = new AbortController();
    const run = processIssue(
      { issueId: issue.id },
      { job: { attempts: 1 }, abortSignal: controller.signal },
    );
    controller.abort();

    await expect(run).rejects.toThrow(/abort/i);
    expect(await statusOf(issue.id)).toBe("processing");
  });
});

describe("processIssue — applying an agent verdict", () => {
  const decided = (over: Record<string, unknown> = {}) =>
    async () => ({
      kind: "decided" as const,
      params: {
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
        reason: "agent recommended auto_resolve at 95%",
        ...over,
      },
    });

  it("resolves an issue the agent decided with high confidence", async () => {
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1), { decide: decided() });

    expect(await statusOf(issue.id)).toBe("resolved");
    expect((await historyOf(issue.id)).map((r) => r.to_status)).toEqual([
      "pending",
      "processing",
      "resolved",
    ]);

    const { rows } = await pool.query(
      "SELECT actor, recommendation, routing_band FROM issue_decisions WHERE issue_id = $1",
      [issue.id],
    );
    expect(rows[0]).toMatchObject({
      actor: "agent",
      recommendation: "auto_resolve",
      routing_band: "auto_execute",
    });
  });

  it("parks when the agent reached no usable verdict", async () => {
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1), {
      decide: async () => ({
        kind: "no_verdict" as const,
        reason: "agent decision cited no valid policies.md line",
      }),
    });

    expect(await statusOf(issue.id)).toBe("needs_review");
    const history = await historyOf(issue.id);
    expect(history[history.length - 1].reason).toMatch(/citation|cited/i);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM issue_decisions WHERE issue_id = $1",
      [issue.id],
    );
    // Nothing decided anything, so no decision row is written.
    expect(rows[0].n).toBe(0);
  });

  it("still parks the issue when the agent fails permanently", async () => {
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1), {
      decide: async () => {
        throw new TerminalError("agent call failed with status 401");
      },
    });

    expect(await statusOf(issue.id)).toBe("needs_review");
  });
});
