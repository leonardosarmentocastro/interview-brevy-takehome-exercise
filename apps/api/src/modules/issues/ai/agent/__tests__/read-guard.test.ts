import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { HookInput } from "@anthropic-ai/claude-agent-sdk";
import { PACKAGE_ROOT, readGuardHook } from "@/modules/issues/ai/agent/read-guard";
import { policyPath } from "@/modules/issues/ai/data/records";

// The hook only ever reads four fields; the rest of BaseHookInput is noise.
const readOf = (file_path: unknown): HookInput =>
  ({
    hook_event_name: "PreToolUse",
    tool_name: "Read",
    tool_input: { file_path },
    tool_use_id: "toolu_test",
    session_id: "sess_test",
    transcript_path: "/dev/null",
    cwd: PACKAGE_ROOT,
  }) as unknown as HookInput;

const decide = async (input: HookInput): Promise<string | undefined> => {
  const out = await readGuardHook(input, "toolu_test", {
    signal: new AbortController().signal,
  });
  return (out as { hookSpecificOutput?: { permissionDecision?: string } })
    .hookSpecificOutput?.permissionDecision;
};

describe("readGuardHook", () => {
  it("allows the policy document", async () => {
    expect(await decide(readOf(policyPath))).not.toBe("deny");
  });

  it("allows the policy document reached by a relative path", async () => {
    expect(
      await decide(readOf("src/modules/issues/ai/data/policies.md")),
    ).not.toBe("deny");
  });

  it("allows a skill file", async () => {
    expect(
      await decide(readOf(resolve(PACKAGE_ROOT, ".claude/skills/refunds/SKILL.md"))),
    ).not.toBe("deny");
  });

  // The reason this task exists: ANTHROPIC_API_KEY and DATABASE_URL live here.
  it("denies the env file", async () => {
    expect(await decide(readOf(".env"))).toBe("deny");
  });

  // tools.ts exists so records arrive one at a time through an audited call.
  // Reading the fixture whole would route around that.
  it("denies the fixture records", async () => {
    expect(
      await decide(readOf("src/modules/issues/ai/data/transactions.json")),
    ).toBe("deny");
  });

  it("denies an escape by traversal", async () => {
    expect(await decide(readOf("../../../../etc/passwd"))).toBe("deny");
  });

  // A Read whose path is missing or not a string cannot be vetted, so it
  // fails closed rather than falling through the allow branch.
  it("denies a read with no usable path", async () => {
    expect(await decide(readOf(undefined))).toBe("deny");
    expect(await decide(readOf({ nested: true }))).toBe("deny");
  });

  it("tells a denied agent where to get the data instead", async () => {
    const out = await readGuardHook(readOf(".env"), "toolu_test", {
      signal: new AbortController().signal,
    });
    const reason = (
      out as { hookSpecificOutput?: { permissionDecisionReason?: string } }
    ).hookSpecificOutput?.permissionDecisionReason;
    expect(reason).toMatch(/get_customer|get_transaction/);
    expect(reason).toContain(policyPath);
  });

  it("leaves tools other than Read alone", async () => {
    const call = {
      ...readOf(".env"),
      tool_name: "mcp__payments__get_customer",
    } as unknown as HookInput;
    expect(await decide(call)).toBeUndefined();
  });
});
