/**
 * Transient failure — the dependency is expected to recover, so the job should
 * back off and try again.
 */
export class RetryableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RetryableError";
  }
}

/**
 * Permanent failure — retrying changes nothing (bad credentials, malformed
 * request). Fail on the first attempt so it surfaces immediately.
 */
export class TerminalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TerminalError";
  }
}

// Default-deny. The retryable set is enumerable; the failure set is not.
export const isRetryable = (err: unknown): boolean =>
  err instanceof RetryableError;

export const MAX_ATTEMPTS = {
  // Graphile Worker's backoff is a fixed exp(least(10, attempt)) seconds. Eight
  // attempts span ~1h18m, which covers "the AI provider is down for more than
  // an hour" for 8 calls. A ninth would push the total to ~3h33m — too long to
  // leave a payment issue unattended. The library default of 25 spans days.
  processIssue: 8,
  // `ingest_issues` is absent on purpose. Cron-scheduled jobs are queued by the
  // worker itself, not by `enqueue()`, so their budget is set in the `crontab`
  // line — see the comment there. Duplicating it here would create two sources
  // of truth with nothing keeping them in agreement.
} as const;
