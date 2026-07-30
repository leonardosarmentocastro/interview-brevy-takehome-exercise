import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { enqueue } from "@/queue/enqueue";
import { listJobs } from "@test/queue";

describe("enqueue", () => {
  it("adds a job that is visible after the transaction commits", async () => {
    await db.transaction(async (tx) => {
      await enqueue(tx, "process_issue", { issueId: "abc" }, {
        jobKey: "abc",
        maxAttempts: 8,
      });
    });

    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].task_identifier).toBe("process_issue");
    expect(jobs[0].key).toBe("abc");
    expect(jobs[0].max_attempts).toBe(8);
  });

  it("adds NO job when the transaction rolls back", async () => {
    // This is the whole reason for a Postgres-backed queue: the enqueue is part
    // of the caller's transaction, so it cannot survive a rollback. With Redis
    // this job would leak.
    await expect(
      db.transaction(async (tx) => {
        await enqueue(tx, "process_issue", { issueId: "abc" }, {
          jobKey: "abc",
          maxAttempts: 8,
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await listJobs()).toEqual([]);
  });

  it("collapses a duplicate enqueue for the same job key", async () => {
    for (const _ of [1, 2]) {
      await db.transaction(async (tx) => {
        await enqueue(tx, "process_issue", { issueId: "abc" }, {
          jobKey: "abc",
          maxAttempts: 8,
        });
      });
    }

    expect(await listJobs()).toHaveLength(1);
  });
});
