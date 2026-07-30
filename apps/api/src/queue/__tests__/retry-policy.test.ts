import { describe, expect, it } from "vitest";
import {
  isRetryable,
  MAX_ATTEMPTS,
  RetryableError,
  TerminalError,
} from "@/queue/retry-policy";

describe("isRetryable", () => {
  it("retries transient failures", () => {
    expect(isRetryable(new RetryableError("429 rate limited"))).toBe(true);
  });

  it("does not retry failures that retrying cannot fix", () => {
    expect(isRetryable(new TerminalError("401 bad credentials"))).toBe(false);
  });

  it("treats unknown errors as terminal", () => {
    // Default-deny: a bug in our own code should surface on attempt 1 rather
    // than burning the whole retry budget over 78 minutes before anyone notices.
    expect(isRetryable(new TypeError("cannot read property of undefined"))).toBe(
      false,
    );
    expect(isRetryable("not even an error")).toBe(false);
  });
});

describe("MAX_ATTEMPTS", () => {
  it("gives process_issue enough attempts to outlast an hour-long outage", () => {
    // exp(least(10, attempt)) seconds cumulative: 8 attempts spans ~1h18m.
    expect(MAX_ATTEMPTS.processIssue).toBe(8);
  });
});
