import { afterEach, describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { processIssue } from "@/modules/issues/tasks/process-issue";
import { declineBody } from "@/modules/issues/__tests__/fixtures";

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
