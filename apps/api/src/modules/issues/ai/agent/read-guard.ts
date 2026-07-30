import { realpathSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { policyPath } from "@/modules/issues/ai/data/records";

// The skills and the policy document both resolve relative to the api
// package, not the process cwd — a worker may be started from anywhere in the
// monorepo. run.ts imports this rather than recomputing the hop.
export const PACKAGE_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

// Resolved through symlinks so two spellings of the same file compare equal,
// and so a link planted under an allowed name cannot point somewhere else.
// A path that does not exist cannot be a symlink, so plain resolution is the
// honest fallback — and an unreadable path denies on the comparison anyway.
const canonical = (p: string): string => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};

const POLICY_FILE = canonical(policyPath);
const SKILLS_DIR = canonical(resolve(PACKAGE_ROOT, ".claude/skills")) + sep;

export const ALLOWED_READ_ROOTS = [POLICY_FILE, SKILLS_DIR];

const DENIAL_REASON =
  `Read is confined to the policy document. Customer and transaction records ` +
  `come from get_customer and get_transaction, never from files — reading a ` +
  `fixture directly is not permitted. The policy document is at ${POLICY_FILE}.`;

const deny = {
  continue: true,
  hookSpecificOutput: {
    hookEventName: "PreToolUse" as const,
    permissionDecision: "deny" as const,
    permissionDecisionReason: DENIAL_REASON,
  },
};

// `continue: true` on the denial is deliberate: block the call, not the run.
// The agent reads the reason, re-aims at the policy path or a typed tool, and
// still produces a decision.
const allow = { continue: true };

/**
 * Bounds what the agent can open.
 *
 * `Read` is enumerated in `allowedTools`, which pre-approves it, and `cwd` is
 * a starting directory rather than a jail — `Read` accepts absolute paths. So
 * this hook, not the permission layer, is what keeps `.env` out of reach.
 */
export const readGuardHook: HookCallback = async (input) => {
  if (input.hook_event_name !== "PreToolUse" || input.tool_name !== "Read") {
    return allow;
  }

  const requested = (input.tool_input as { file_path?: unknown })?.file_path;
  if (typeof requested !== "string" || requested.length === 0) return deny;

  const target = canonical(
    isAbsolute(requested) ? requested : resolve(PACKAGE_ROOT, requested),
  );

  return target === POLICY_FILE || target.startsWith(SKILLS_DIR) ? allow : deny;
};
