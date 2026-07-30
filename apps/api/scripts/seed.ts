import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createIssueSchema } from "@/modules/issues/schema";
import { ingestIssue } from "@/modules/issues/ingest";
import { pool } from "@/db/client";

// apps/api/scripts/seed.ts -> repo root docs/initial/payment_issues.json
const dataPath = fileURLToPath(
  new URL("../../../docs/initial/payment_issues.json", import.meta.url),
);

async function main(): Promise<void> {
  const issues = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  for (const raw of issues) {
    const created = await ingestIssue(createIssueSchema.parse(raw));
    console.log(
      created
        ? `seeded ${created.externalId} -> ${created.id} (queued)`
        : `skip (already exists)`,
    );
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
