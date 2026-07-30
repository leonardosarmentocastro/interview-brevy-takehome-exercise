import { db } from "@/db/client";
import { toIssueRow } from "@/modules/issues/normalizer";
import { issuesRepository } from "@/modules/issues/repository";
import type { CreateIssueInput } from "@/modules/issues/schema";
import type { IssueRow } from "@/modules/issues/types";
import { enqueue } from "@/queue/enqueue";
import { MAX_ATTEMPTS } from "@/queue/retry-policy";

/**
 * The single door into the system. `POST /issues`, the ingest cron task and the
 * seed script all call this; a webhook would be a fourth caller needing no
 * change here.
 *
 * The insert and the enqueue are one transaction, so there is no window in
 * which an issue exists with no job waiting to process it.
 *
 * Returns `null` when the issue was already known.
 */
export const ingestIssue = async (
  raw: CreateIssueInput,
): Promise<IssueRow | null> =>
  db.transaction(async (tx) => {
    const created = await issuesRepository.insertIfNew(tx, toIssueRow(raw));
    if (!created) return null; // already known → no job

    await enqueue(
      tx,
      "process_issue",
      { issueId: created.id },
      { jobKey: created.id, maxAttempts: MAX_ATTEMPTS.processIssue },
    );
    return created;
  });
