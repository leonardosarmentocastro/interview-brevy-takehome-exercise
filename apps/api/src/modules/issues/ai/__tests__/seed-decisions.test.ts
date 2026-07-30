import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { agentDecisionSchema } from "@/modules/issues/ai/agent/output-schema";
import { hasValidCitation, verifyCitedFacts } from "@/modules/issues/ai/confidence/verify";
import { score } from "@/modules/issues/ai/confidence/score";
import { bandFor } from "@/modules/issues/ai/routing";
import { toIssueRow } from "@/modules/issues/ingestion/normalizer";
import { fetchIssues } from "@/modules/issues/ingestion/sources/file-source";
import type { IssueRow } from "@/modules/issues/types";

const recorded = (externalId: string) =>
  agentDecisionSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL(`./recorded/${externalId}.json`, import.meta.url)),
        "utf8",
      ),
    ),
  );

const issues = new Map(
  fetchIssues().map((input) => {
    const row = toIssueRow(input);
    return [row.externalId, { ...row, status: "processing" } as unknown as IssueRow];
  }),
);

describe("recorded agent decisions", () => {
  it.each([...issues.keys()])("%s produces a well-formed, cited decision", (id) => {
    const decision = recorded(id);
    expect(hasValidCitation(decision)).toBe(true);
    expect(decision.trace.length).toBeGreaterThan(0);
  });

  it.each([...issues.keys()])("%s cites facts that hold against source data", (id) => {
    expect(verifyCitedFacts(recorded(id), issues.get(id)!)).toEqual({ ok: true });
  });

  it("never auto-executes a case the policy caps", () => {
    // iss_003 is a $249 dispute (:53) and iss_005 belongs to a customer with
    // $4,205 lifetime spend (:88). Neither may reach the auto-execute band,
    // whatever the model felt about them.
    for (const id of ["iss_003", "iss_005"]) {
      const final = score(recorded(id), issues.get(id)!).final;
      expect(final).toBeLessThan(0.9);
    }
  });

  it("auto-executes the clean refund", () => {
    // iss_004: within 14 days, not shipped, $149, customer under the
    // high-value threshold. Nothing caps it, so a confident model reaches the
    // top band — the design must let a clean case through, not just block.
    const final = score(recorded("iss_004"), issues.get("iss_004")!).final;
    expect(bandFor(final)).toBe("auto_execute");
  });

  it("covers more than one routing band across the seed set", () => {
    const bands = new Set(
      [...issues.keys()].map((id) => bandFor(score(recorded(id), issues.get(id)!).final)),
    );
    expect(bands.size).toBeGreaterThan(1);
  });
});
