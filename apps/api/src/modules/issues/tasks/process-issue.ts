import { decide } from "@/modules/issues/decide";
import { hasLeftTheQueue } from "@/modules/issues/lifecycle";
import { issuesRepository } from "@/modules/issues/repository";
import { isRetryable, MAX_ATTEMPTS } from "@/queue/retry-policy";

export type ProcessIssuePayload = { issueId: string };

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
): Promise<void> => {
  const issue = await issuesRepository.findByIdOrExternalId(issueId);
  if (!issue) return; // deleted between enqueue and run — nothing to do
  if (hasLeftTheQueue(issue.status)) return; // entry guard

  await issuesRepository.beginProcessing(issue);
  const processing = { ...issue, status: "processing" as const };

  try {
    await decide(processing, { signal: helpers.abortSignal });
  } catch (err) {
    // Without this last-attempt check, an exhausted retryable failure lets the
    // queue mark the job permanently failed — stranding the issue in
    // `processing`, where nobody is looking.
    const lastChance = helpers.job.attempts >= MAX_ATTEMPTS.processIssue;
    if (isRetryable(err) && !lastChance) throw err; // → exponential backoff

    await issuesRepository.parkForHumanReview(processing, reasonFrom(err));
    return; // job SUCCEEDS — the dead letter is a human lane, not a void
  }

  // v1 has no decider, so every successfully-processed issue needs a person.
  await issuesRepository.parkForHumanReview(
    processing,
    "awaiting human decision",
  );
};
