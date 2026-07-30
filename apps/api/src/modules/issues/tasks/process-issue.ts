import { decide } from "@/modules/issues/ai/decide";
import { issuesRepository } from "@/modules/issues/repository";
import type { IssueStatus } from "@/modules/issues/types";
import { isRetryable, MAX_ATTEMPTS } from "@/queue/retry-policy";

export type ProcessIssuePayload = { issueId: string };

/** Injectable so tests exercise the worker's mechanics without a model call. */
export type ProcessDeps = { decide: typeof decide };

// The only two statuses the worker is responsible for.
const OWNED_BY_QUEUE: IssueStatus[] = ["pending", "processing"];

/**
 * Has this issue already passed out of the queue's control?
 *
 * Deliberately NOT the same question as `state-machine.ts`, which maps human
 * review verbs to statuses.
 */
const hasLeftTheQueue = (status: IssueStatus): boolean =>
  !OWNED_BY_QUEUE.includes(status);

/** The subset of Graphile Worker's `helpers` this handler actually uses. */
export type ProcessHelpers = {
  job: { attempts: number };
  abortSignal?: AbortSignal;
};

const reasonFrom = (err: unknown): string =>
  `processing failed permanently: ${err instanceof Error ? err.message : String(err)}`;

export const processIssue = async (
  { issueId }: ProcessIssuePayload,
  helpers: ProcessHelpers,
  deps: ProcessDeps = { decide },
): Promise<void> => {
  const issue = await issuesRepository.findByIdOrExternalId(issueId);
  if (!issue) return; // deleted between enqueue and run — nothing to do
  // Entry guard. Closes the window where the outcome transaction commits and
  // the process dies before the job is marked complete: the job is retried
  // against finished work, and without this the issue would be decided twice.
  if (hasLeftTheQueue(issue.status)) return;

  await issuesRepository.beginProcessing(issue);
  const processing = { ...issue, status: "processing" as const };

  let result;
  try {
    result = await deps.decide(processing, { signal: helpers.abortSignal });
  } catch (err) {
    // Shutdown abort must release the lease and let a restarted worker resume —
    // it is not a permanent failure and must not park the issue.
    if (helpers.abortSignal?.aborted) throw err;

    // Without this last-attempt check, an exhausted retryable failure lets the
    // queue mark the job permanently failed — stranding the issue in
    // `processing`, where nobody is looking.
    const lastChance = helpers.job.attempts >= MAX_ATTEMPTS.processIssue;
    if (isRetryable(err) && !lastChance) throw err; // → exponential backoff

    await issuesRepository.parkForHumanReview(processing, reasonFrom(err));
    return; // job SUCCEEDS — the dead letter is a human lane, not a void
  }

  // No verdict means nothing decided anything, so no decision row is written —
  // the issue simply goes to a person, with the reason recorded.
  if (result.kind === "no_verdict") {
    await issuesRepository.parkForHumanReview(processing, result.reason);
    return;
  }

  await issuesRepository.applyAgentDecision(processing, result.params);
};
