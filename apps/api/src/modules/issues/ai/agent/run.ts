import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  agentDecisionJsonSchema,
  agentDecisionSchema,
  type AgentDecision,
} from "@/modules/issues/ai/agent/output-schema";
import { mapAgentError } from "@/modules/issues/ai/agent/errors";
import { SYSTEM_PROMPT, buildPrompt } from "@/modules/issues/ai/agent/prompt";
import {
  PAYMENTS_TOOL_NAMES,
  paymentsTools,
} from "@/modules/issues/ai/agent/tools";
import type { IssueRow } from "@/modules/issues/types";

export const AGENT_MODEL = "claude-opus-5";

// Bounds a runaway loop. Twelve is comfortably above the observed shape of a
// decision (load skill, read policy, two lookups, answer) without letting a
// confused run burn the queue's whole retry budget in one attempt.
const MAX_TURNS = 12;

// The skills and the policy document both resolve relative to the api package,
// not the process cwd — a worker may be started from anywhere in the monorepo.
const PACKAGE_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

export type AgentRunner = (
  issue: IssueRow,
  opts: { signal?: AbortSignal },
) => Promise<AgentDecision>;

const FENCED = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;

/**
 * Turns whatever the SDK hands back into a validated decision.
 *
 * `outputFormat` should make the fenced-block and string cases unnecessary,
 * but a wrapper the SDK version happens to add must not be the difference
 * between a decision and an outage.
 */
export const parseAgentResult = (raw: unknown): AgentDecision => {
  if (raw === undefined || raw === null) {
    throw new Error("agent returned no result");
  }
  if (typeof raw === "object") return agentDecisionSchema.parse(raw);

  const text = String(raw);
  const unwrapped = FENCED.exec(text)?.[1] ?? text;
  return agentDecisionSchema.parse(JSON.parse(unwrapped));
};

/**
 * One decision, one query.
 *
 * The worker's abort signal is bridged into the SDK's AbortController so a
 * SIGTERM cancels an in-flight model call instead of orphaning it — the queue
 * then releases the lease and a restarted worker resumes the issue.
 */
export const runAgent: AgentRunner = async (issue, { signal }) => {
  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    let result: unknown;

    for await (const message of query({
      prompt: buildPrompt(issue),
      options: {
        model: AGENT_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        cwd: PACKAGE_ROOT,
        settingSources: ["project"], // loads .claude/skills/*
        mcpServers: { payments: paymentsTools },
        // Enumerated, read-only. No Write, no Edit, no Bash: a fully hijacked
        // agent can read the policy and two fixtures and nothing else.
        allowedTools: ["Read", "Skill", ...PAYMENTS_TOOL_NAMES],
        outputFormat: { type: "json_schema", schema: agentDecisionJsonSchema },
        maxTurns: MAX_TURNS,
        abortController: controller,
        permissionMode: "dontAsk",
      },
    })) {
      if (message && typeof message === "object" && "result" in message) {
        result = (message as { result: unknown }).result;
      }
    }

    return parseAgentResult(result);
  } catch (err) {
    // An abort is the worker shutting down, not a provider fault. Rethrow it
    // unwrapped so process-issue's abort branch sees it.
    if (controller.signal.aborted) throw err;
    throw mapAgentError(err);
  }
};
