import { setTimeout as delay } from "node:timers/promises";
import { AGENT_MODEL, runAgent, type AgentRunner } from "@/modules/issues/ai/agent/run";
import {
  hasValidCitation,
  verifyCitedFacts,
} from "@/modules/issues/ai/confidence/verify";
import { score } from "@/modules/issues/ai/confidence/score";
import { route } from "@/modules/issues/ai/routing";
import type { AgentDecisionParams } from "@/modules/issues/repository";
import type { IssueRow } from "@/modules/issues/types";
import { RetryableError, TerminalError, isRetryable } from "@/queue/retry-policy";

export type DecideOpts = { signal?: AbortSignal };

export type DecideResult =
  | { kind: "decided"; params: AgentDecisionParams }
  | { kind: "no_verdict"; reason: string };

const park = (reason: string): DecideResult => ({ kind: "no_verdict", reason });

const summarize = (breakdown: { penalties: { reason: string }[]; caps: { src: number }[] }) => {
  const notes = [
    ...breakdown.penalties.map((p) => p.reason),
    ...breakdown.caps.map((c) => `capped by policies.md:${c.src}`),
  ];
  return notes.length ? ` (${notes.join("; ")})` : "";
};

/**
 * The processing step: agent decides, deterministic code adjudicates.
 *
 * Four stages, only the first of which is non-deterministic:
 *   1. the agent produces a claim
 *   2. verification re-checks that claim against source records
 *   3. scoring lowers confidence for gaps and policy caps — never raises it
 *   4. routing turns the score into a status and a verb
 *
 * The runner is injectable so every test above runs offline.
 */
export const decide = async (
  issue: IssueRow,
  opts: DecideOpts,
  runner: AgentRunner = runAgent,
): Promise<DecideResult> => {
  // Read at call time, not module load, so a test can flip modes per case.
  switch (process.env.DECIDE_MODE ?? "agent") {
    case "fail_retryable":
      throw new RetryableError("simulated transient upstream failure");
    case "fail_terminal":
      throw new TerminalError("simulated permanent upstream failure");
    case "slow":
      // Honours the abort signal — throws on abort instead of running to term.
      await delay(30_000, undefined, { signal: opts.signal });
      return park("awaiting human decision");
    case "stub":
      return park("awaiting human decision");
  }

  let decision;
  try {
    decision = await runner(issue, { signal: opts.signal });
  } catch (err) {
    // A retryable fault is the queue's business — it owns the backoff budget.
    // Anything else means this issue will never decide itself, so hand it to a
    // person rather than burning eight attempts on it.
    if (isRetryable(err) || opts.signal?.aborted) throw err;
    return park(
      `agent produced no usable decision: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // No citation is malformed output, not weak output. Nothing to score.
  if (!hasValidCitation(decision)) {
    return park("agent decision has no valid policies.md citation");
  }

  const breakdown = score(decision, issue);

  // The verification override: a cited fact that contradicts its source is not
  // a low-confidence decision, it is a disqualified one. This is the one place
  // the routing table does not apply — policies.md:86 applied literally.
  const verification = verifyCitedFacts(decision, issue);
  if (!verification.ok) {
    return {
      kind: "decided",
      params: {
        recommendation: decision.recommendation,
        decision: "escalate",
        target: "escalated",
        band: "human_decision",
        reasoning: decision.reasoning,
        model: AGENT_MODEL,
        confidence: 0,
        confidenceBase: decision.confidence,
        scoreBreakdown: { ...breakdown, final: 0 },
        trace: decision.trace,
        reason: `escalated: cited evidence failed verification — ${verification.mismatches.join("; ")}`,
      },
    };
  }

  const routed = route(decision.recommendation, breakdown.final);
  const percent = Math.round(breakdown.final * 100);

  return {
    kind: "decided",
    params: {
      recommendation: decision.recommendation,
      decision: routed.decision,
      target: routed.status,
      band: routed.band,
      reasoning: decision.reasoning,
      model: AGENT_MODEL,
      confidence: breakdown.final,
      confidenceBase: decision.confidence,
      scoreBreakdown: breakdown,
      trace: decision.trace,
      reason: `agent recommended ${decision.recommendation} at ${percent}%${summarize(breakdown)}`,
    },
  };
};
