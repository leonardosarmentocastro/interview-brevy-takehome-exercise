import { runOnce } from "graphile-worker";
import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { taskList } from "@/queue/runner";
import { declineBody } from "@/modules/issues/__tests__/fixtures";
import { listJobs } from "@test/queue";

describe("worker wiring", () => {
  it("drains a queued issue through the real runner", async () => {
    // Everything else is tested by calling handlers directly. This one test
    // proves the wiring: that the task name in the payload matches a task the
    // runner actually registers.
    const issue = (await ingestIssue(createIssueSchema.parse(declineBody)))!;
    expect(await listJobs()).toHaveLength(1);

    await runOnce({ pgPool: pool, taskList });

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("needs_review");
    expect(await listJobs()).toHaveLength(0);
  });
});
