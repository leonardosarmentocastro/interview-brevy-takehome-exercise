/**
 * Replays the recorded decisions through the deterministic pipeline and prints
 * how each of the five issues was processed. Offline — no API key needed.
 *
 * Usage: npm run demo
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { agentDecisionSchema } from "@/modules/issues/ai/agent/output-schema";
import { score } from "@/modules/issues/ai/confidence/score";
import { route } from "@/modules/issues/ai/routing";
import { toIssueRow } from "@/modules/issues/ingestion/normalizer";
import { fetchIssues } from "@/modules/issues/ingestion/sources/file-source";
import type { IssueRow } from "@/modules/issues/types";

for (const input of fetchIssues()) {
  const row = toIssueRow(input);
  const issue = { ...row, status: "processing" } as unknown as IssueRow;
  const decision = agentDecisionSchema.parse(
    JSON.parse(
      readFileSync(
        fileURLToPath(
          new URL(
            `../src/modules/issues/ai/__tests__/recorded/${row.externalId}.json`,
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    ),
  );

  const breakdown = score(decision, issue);
  const routed = route(decision.recommendation, breakdown.final);

  console.log(`\n${row.externalId}  ${row.type}`);
  console.log(`  base (model self-report)      ${breakdown.base.toFixed(2)}`);
  for (const p of breakdown.penalties) {
    console.log(`  − ${p.reason.padEnd(28)}${p.amount.toFixed(2)}`);
  }
  for (const c of breakdown.caps) {
    console.log(`  cap policies.md:${String(c.src).padEnd(4)}          ${c.ceiling.toFixed(2)}  ← ${c.reason}`);
  }
  console.log(`  → ${Math.round(breakdown.final * 100)}%   ${routed.band} → ${routed.status}`);
  console.log(`  ${decision.reasoning}`);
}
