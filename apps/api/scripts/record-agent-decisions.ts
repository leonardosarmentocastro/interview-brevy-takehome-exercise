/**
 * Captures one real agent decision per seed issue as a fixture, so the golden
 * test replays them offline and deterministically. Re-run whenever the prompt,
 * the skills or policies.md change.
 *
 * Usage: npm run record:decisions
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runAgent } from "@/modules/issues/ai/agent/run";
import { fetchIssues } from "@/modules/issues/ingestion/sources/file-source";
import { toIssueRow } from "@/modules/issues/ingestion/normalizer";
import type { IssueRow } from "@/modules/issues/types";

const outDir = fileURLToPath(
  new URL("../src/modules/issues/ai/__tests__/recorded/", import.meta.url),
);
mkdirSync(outDir, { recursive: true });

for (const input of fetchIssues()) {
  const row = toIssueRow(input);
  const issue = {
    ...row,
    id: `00000000-0000-0000-0000-0000000000${row.externalId.slice(-2)}`,
    status: "processing",
  } as unknown as IssueRow;

  process.stdout.write(`recording ${row.externalId}… `);
  const decision = await runAgent(issue, {});
  writeFileSync(
    `${outDir}${row.externalId}.json`,
    `${JSON.stringify(decision, null, 2)}\n`,
  );
  console.log(`${decision.recommendation} @ ${decision.confidence}`);
}
