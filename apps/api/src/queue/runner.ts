import type { RunnerOptions, TaskList } from "graphile-worker";
import { pool } from "@/db/client";
import { ingestIssues, processIssue } from "@/modules/issues/tasks";
import type {
  ProcessHelpers,
  ProcessIssuePayload,
} from "@/modules/issues/tasks/process-issue";

/**
 * Task names are the contract between `enqueue()` and the worker. They are
 * declared here, once, so a typo shows up as a job nobody can run rather than
 * as silence.
 */
export const taskList: TaskList = {
  ingest_issues: async () => {
    await ingestIssues();
  },
  process_issue: async (payload, helpers) => {
    await processIssue(
      payload as ProcessIssuePayload,
      helpers as unknown as ProcessHelpers,
    );
  },
};

export const runnerOptions: RunnerOptions = {
  // Share the API's pool so there is one connection story, not two.
  pgPool: pool,
  taskList,
  // Left at the library default. Tuning concurrency against a rate limit is
  // for the cycle that introduces a rate limit.
};
