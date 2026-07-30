import { pool } from "@/db/client";

export type JobRow = {
  id: string;
  task_identifier: string;
  /**
   * The job key we enqueue with. For `process_issue` this is the issue's id,
   * which is how a test identifies the job belonging to an issue.
   *
   * The payload would be the more obvious handle, but Graphile Worker 0.17's
   * public `jobs` view deliberately does not expose it — the column lives only
   * on `_private_jobs`, which tests must not read.
   */
  key: string | null;
  attempts: number;
  max_attempts: number;
  run_at: Date;
  last_error: string | null;
};

// Reads the PUBLIC `graphile_worker.jobs` view — the documented, stable
// interface. Never read `_private_jobs`: it can change in a minor version.
export const listJobs = async (): Promise<JobRow[]> => {
  const { rows } = await pool.query<JobRow>(
    `SELECT id, task_identifier, key, attempts, max_attempts, run_at, last_error
     FROM graphile_worker.jobs
     ORDER BY created_at`,
  );
  return rows;
};

export const jobsForIssue = async (issueId: string): Promise<JobRow[]> =>
  (await listJobs()).filter((job) => job.key === issueId);
