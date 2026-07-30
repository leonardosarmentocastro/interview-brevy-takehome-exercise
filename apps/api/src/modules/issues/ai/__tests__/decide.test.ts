import { afterEach, describe, expect, it } from "vitest";
import { decide } from "@/modules/issues/ai/decide";
import { RetryableError, TerminalError } from "@/queue/retry-policy";
import type { IssueRow } from "@/modules/issues/types";

const issue = { id: "00000000-0000-0000-0000-000000000001" } as IssueRow;

afterEach(() => {
  delete process.env.DECIDE_MODE;
});

describe("decide", () => {
  it("succeeds by default — v1 has no intelligence, so a human decides", async () => {
    await expect(decide(issue, {})).resolves.toBeUndefined();
  });

  it("throws a retryable error in fail_retryable mode", async () => {
    process.env.DECIDE_MODE = "fail_retryable";
    await expect(decide(issue, {})).rejects.toBeInstanceOf(RetryableError);
  });

  it("throws a terminal error in fail_terminal mode", async () => {
    process.env.DECIDE_MODE = "fail_terminal";
    await expect(decide(issue, {})).rejects.toBeInstanceOf(TerminalError);
  });

  it("aborts promptly in slow mode when the signal fires", async () => {
    // This is what makes "kill the worker mid-issue and restart" demonstrable
    // before any AI exists: SIGTERM aborts in-flight work rather than blocking
    // shutdown until the delay elapses.
    process.env.DECIDE_MODE = "slow";
    const controller = new AbortController();
    const promise = decide(issue, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/abort/i);
  });
});
