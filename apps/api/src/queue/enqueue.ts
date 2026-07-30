import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";

export type EnqueueOpts = {
  /** Dedupe key. A second enqueue with the same key is discarded. */
  jobKey: string;
  maxAttempts: number;
};

/**
 * Adds a job **inside the caller's transaction**.
 *
 * This is the load-bearing piece of the queue design. Graphile Worker's JS
 * `addJob` helper uses its own connection pool, which would make enqueueing a
 * second write outside the caller's transaction — a dual-write, where a crash
 * between the two commits strands the row with no job. `add_job` is a SQL
 * function, so calling it on the transaction's own connection makes the row and
 * its job commit or roll back together.
 */
export const enqueue = async (
  tx: Tx,
  name: string,
  payload: Record<string, unknown>,
  opts: EnqueueOpts,
): Promise<void> => {
  await tx.execute(sql`
    select graphile_worker.add_job(
      ${name}::text,
      payload      := ${JSON.stringify(payload)}::json,
      max_attempts := ${opts.maxAttempts}::int,
      job_key      := ${opts.jobKey}::text,
      job_key_mode := 'unsafe_dedupe'
    )
  `);
};
