import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { declineBody } from "@/modules/issues/__tests__/fixtures";
import { listJobs } from "@test/queue";

const raw = () => createIssueSchema.parse(declineBody);

describe("ingestIssue", () => {
  it("stores the issue as pending and queues exactly one job for it", async () => {
    const issue = await ingestIssue(raw());

    expect(issue).not.toBeNull();
    expect(issue!.status).toBe("pending");

    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].task_identifier).toBe("process_issue");
    expect(jobs[0].key).toBe(issue!.id);
    expect(jobs[0].max_attempts).toBe(8);
  });

  it("records the intake transition", async () => {
    const issue = await ingestIssue(raw());

    const { rows } = await pool.query(
      "SELECT from_status, to_status, actor FROM issue_status_history WHERE issue_id = $1",
      [issue!.id],
    );
    expect(rows).toEqual([
      { from_status: null, to_status: "pending", actor: "system" },
    ]);
  });

  it("ignores an issue it has already seen, and queues no second job", async () => {
    // Intake dedupe and job dedupe are the same line of code: no insert means
    // no enqueue. This is what makes re-running the cron over a static file a
    // no-op forever.
    const first = await ingestIssue(raw());
    const second = await ingestIssue(raw());

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const { rows } = await pool.query("SELECT id FROM issues");
    expect(rows).toHaveLength(1);
    expect(await listJobs()).toHaveLength(1);
  });
});
