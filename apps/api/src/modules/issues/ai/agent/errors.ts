import { RetryableError, TerminalError } from "@/queue/retry-policy";

// 408 request timeout, 409 conflict, 429 rate limit, 5xx server, 529 overloaded.
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const TRANSPORT_FAILURE =
  /(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|fetch failed|network error|timed? ?out)/i;

const statusOf = (err: unknown): number | undefined => {
  if (typeof err !== "object" || err === null) return undefined;
  const candidate = err as { status?: unknown; statusCode?: unknown };
  for (const value of [candidate.status, candidate.statusCode]) {
    if (typeof value === "number") return value;
  }
  return undefined;
};

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * Classifies an Agent SDK / Anthropic API failure for the queue.
 *
 * This is the only place that knows what Anthropic is. `retry-policy.ts` sees
 * `RetryableError` and `TerminalError` and nothing else, so the queue's
 * backoff budget — 8 attempts, roughly 1h18m — covers "the AI API is down for
 * an hour" without the queue layer being taught about providers.
 */
export const mapAgentError = (err: unknown): Error => {
  const status = statusOf(err);
  if (status !== undefined) {
    const message = `agent call failed with status ${status}`;
    return RETRYABLE_STATUS.has(status)
      ? new RetryableError(message, { cause: err })
      : new TerminalError(message, { cause: err });
  }

  if (TRANSPORT_FAILURE.test(messageOf(err))) {
    return new RetryableError(`agent call failed: ${messageOf(err)}`, {
      cause: err,
    });
  }

  // Default deny, matching retry-policy.ts: the retryable set is enumerable,
  // the failure set is not. An unknown fault must surface, not spin.
  return new TerminalError(`agent call failed: ${messageOf(err)}`, { cause: err });
};
