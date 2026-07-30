import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssues } from "@/modules/issues/tasks/ingest-issues";
import { listJobs } from "@test/queue";

describe("ingestIssues", () => {
  it("pulls every issue from the source and queues one job each", async () => {
    await ingestIssues();

    const { rows } = await pool.query(
      "SELECT external_id FROM issues ORDER BY external_id",
    );
    expect(rows.map((r) => r.external_id)).toEqual([
      "iss_001",
      "iss_002",
      "iss_003",
      "iss_004",
      "iss_005",
    ]);

    const jobs = await listJobs();
    expect(jobs).toHaveLength(5);
    expect(jobs.every((j) => j.task_identifier === "process_issue")).toBe(true);
  });

  it("is a no-op on every tick after the first", async () => {
    // The cron re-reads the whole file every minute. Because ingest dedupes on
    // the source's id, that costs nothing — which is why this design needs no
    // watermark/cursor at all.
    await ingestIssues();
    await ingestIssues();
    await ingestIssues();

    const { rows } = await pool.query("SELECT id FROM issues");
    expect(rows).toHaveLength(5);
    expect(await listJobs()).toHaveLength(5);
  });
});
