import { describe, expect, it } from "vitest";
import { mapAgentError } from "@/modules/issues/ai/agent/errors";
import { RetryableError, TerminalError } from "@/queue/retry-policy";

describe("mapAgentError", () => {
  it("treats 429 as retryable", () => {
    expect(mapAgentError(Object.assign(new Error("rate limited"), { status: 429 })))
      .toBeInstanceOf(RetryableError);
  });

  it("treats 500 and 529 as retryable", () => {
    expect(mapAgentError(Object.assign(new Error("boom"), { status: 500 })))
      .toBeInstanceOf(RetryableError);
    expect(mapAgentError(Object.assign(new Error("overloaded"), { status: 529 })))
      .toBeInstanceOf(RetryableError);
  });

  it("treats 400 and 401 as terminal — retrying changes nothing", () => {
    expect(mapAgentError(Object.assign(new Error("bad request"), { status: 400 })))
      .toBeInstanceOf(TerminalError);
    expect(mapAgentError(Object.assign(new Error("unauthorized"), { status: 401 })))
      .toBeInstanceOf(TerminalError);
  });

  it("reads statusCode as well as status", () => {
    expect(mapAgentError(Object.assign(new Error("x"), { statusCode: 503 })))
      .toBeInstanceOf(RetryableError);
  });

  it("treats transport failures as retryable", () => {
    expect(mapAgentError(new Error("fetch failed"))).toBeInstanceOf(RetryableError);
    expect(mapAgentError(new Error("socket hang up"))).toBeInstanceOf(RetryableError);
    expect(mapAgentError(new Error("connect ETIMEDOUT"))).toBeInstanceOf(RetryableError);
  });

  it("treats an unrecognised failure as terminal — default deny", () => {
    // Mirrors retry-policy.ts: the retryable set is enumerable, the failure
    // set is not. An unknown fault must not spin for 8 attempts.
    expect(mapAgentError(new Error("something odd"))).toBeInstanceOf(TerminalError);
    expect(mapAgentError("not even an error")).toBeInstanceOf(TerminalError);
  });

  it("preserves the original error as the cause", () => {
    const original = Object.assign(new Error("rate limited"), { status: 429 });
    expect(mapAgentError(original).cause).toBe(original);
  });
});
