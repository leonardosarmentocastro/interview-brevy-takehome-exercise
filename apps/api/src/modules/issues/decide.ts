import { setTimeout as delay } from "node:timers/promises";
import type { IssueRow } from "@/modules/issues/types";
import { RetryableError, TerminalError } from "@/queue/retry-policy";

export type DecideOpts = { signal?: AbortSignal };

/**
 * The processing step — the seam the AI decisioning layer replaces.
 *
 * v1 has no intelligence: it resolves, and the caller parks the issue in
 * `needs_review` for a human. That is an honest stub rather than a fabricated
 * verdict, and it makes the whole pipeline real end to end without pretending.
 *
 * The next cycle replaces the body with prompt assembly + an Anthropic call,
 * and adds a `mapAnthropicError()` that classifies 429/5xx/timeouts as
 * `RetryableError` and 400/401 as `TerminalError`. Nothing in the queue layer
 * changes, and `retry-policy.ts` never learns what Anthropic is.
 */
export const decide = async (
  _issue: IssueRow,
  opts: DecideOpts,
): Promise<void> => {
  // Read at call time, not module load, so a test can flip modes per case.
  switch (process.env.DECIDE_MODE ?? "stub") {
    case "fail_retryable":
      throw new RetryableError("simulated transient upstream failure");
    case "fail_terminal":
      throw new TerminalError("simulated permanent upstream failure");
    case "slow":
      // Honours the abort signal — throws on abort instead of running to term.
      await delay(30_000, undefined, { signal: opts.signal });
      return;
    default:
      return;
  }
};
