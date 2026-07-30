import { afterEach, describe, expect, it } from "vitest";
import { decide } from "@/modules/issues/ai/decide";
import type { AgentDecision } from "@/modules/issues/ai/agent/output-schema";
import { RetryableError, TerminalError } from "@/queue/retry-policy";
import type { IssueRow } from "@/modules/issues/types";

const issue = {
  id: "00000000-0000-0000-0000-000000000001",
  externalId: "iss_004",
  type: "refund_request",
  customerId: "cust_042",
  transactionId: "txn_5998",
  amount: 149,
  status: "processing",
  metadata: { reason: "changed_mind", days_since_purchase: 3 },
} as unknown as IssueRow;

const fraudIssue = {
  ...issue,
  type: "dispute",
  metadata: { reason: "unauthorized_transaction" },
} as unknown as IssueRow;

const decision = (over: Partial<AgentDecision> = {}): AgentDecision => ({
  recommendation: "auto_resolve",
  confidence: 0.95,
  reasoning: "Within the window and unshipped.",
  trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
  citedFacts: [
    { source: "transaction", path: "shipping.status", value: "not_shipped" },
  ],
  dataGap: null,
  ...over,
});

const runnerFor = (d: AgentDecision) => async () => d;

afterEach(() => {
  delete process.env.DECIDE_MODE;
});

describe("decide — fault injection", () => {
  it("parks without a verdict in stub mode", async () => {
    process.env.DECIDE_MODE = "stub";
    expect(await decide(issue, {})).toEqual({
      kind: "no_verdict",
      reason: "awaiting human decision",
    });
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
    process.env.DECIDE_MODE = "slow";
    const controller = new AbortController();
    const promise = decide(issue, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/abort/i);
  });
});

describe("decide — agent mode", () => {
  it("routes a clean, verified decision to auto-execute", async () => {
    const result = await decide(issue, {}, runnerFor(decision()));
    expect(result).toMatchObject({
      kind: "decided",
      params: {
        recommendation: "auto_resolve",
        decision: "resolve",
        target: "resolved",
        band: "auto_execute",
        confidence: 0.95,
        confidenceBase: 0.95,
      },
    });
  });

  it("caps a fraud claim into the human lane while keeping the recommendation", async () => {
    const result = await decide(fraudIssue, {}, runnerFor(decision()));
    expect(result).toMatchObject({
      kind: "decided",
      params: {
        recommendation: "auto_resolve",
        decision: "defer",
        target: "needs_review",
        band: "human_decision",
        confidence: 0.69,
        confidenceBase: 0.95,
      },
    });
  });

  it("escalates when a cited fact contradicts source data", async () => {
    // The hallucination guard. Confidence collapses to zero and the verdict
    // is overridden, whatever the model recommended.
    const result = await decide(
      issue,
      {},
      runnerFor(
        decision({
          citedFacts: [
            { source: "transaction", path: "shipping.status", value: "delivered" },
          ],
        }),
      ),
    );
    expect(result).toMatchObject({
      kind: "decided",
      params: {
        decision: "escalate",
        target: "escalated",
        confidence: 0,
      },
    });
    expect((result as { params: { reason: string } }).params.reason).toMatch(
      /verification/i,
    );
  });

  it("parks when no trace entry cites a real policy line", async () => {
    const result = await decide(
      issue,
      {},
      runnerFor(
        decision({ trace: [{ src: 9999, rule: "r", status: "fired", evidence: "e" }] }),
      ),
    );
    expect(result).toMatchObject({ kind: "no_verdict" });
    expect((result as { reason: string }).reason).toMatch(/citation/i);
  });

  it("parks when the agent returns unusable output", async () => {
    const result = await decide(issue, {}, async () => {
      throw new TerminalError("agent call failed: schema mismatch");
    });
    expect(result).toMatchObject({ kind: "no_verdict" });
  });

  it("lets a retryable failure propagate to the queue", async () => {
    await expect(
      decide(issue, {}, async () => {
        throw new RetryableError("agent call failed with status 429");
      }),
    ).rejects.toBeInstanceOf(RetryableError);
  });
});
