import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createIssueSchema } from "@/modules/issues/schema";
import { toIssueRow } from "@/modules/issues/normalizer";
import { issuesRepository } from "@/modules/issues/repository";
import { ConflictError } from "@/db/data/errors";
import { pool } from "@/db/client";

// apps/api/scripts/seed.ts -> repo root docs/initial/payment_issues.json
const dataPath = fileURLToPath(
  new URL("../../../docs/initial/payment_issues.json", import.meta.url),
);

async function main(): Promise<void> {
  const issues = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  for (const raw of issues) {
    const row = toIssueRow(createIssueSchema.parse(raw));
    try {
      const created = await issuesRepository.create(row);
      console.log(`seeded ${created.externalId} -> ${created.id}`);
    } catch (err) {
      if (err instanceof ConflictError) {
        console.log(`skip ${row.externalId} (already exists)`);
        continue;
      }
      throw err;
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
