import "dotenv/config";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { fetchIssues } from "@/modules/issues/ingestion/sources/file-source";
import { pool } from "@/db/client";

/**
 * A one-shot `ingest_issues`. The cron does exactly this every minute; the
 * script exists so a demo can trigger the pull on demand instead of waiting for
 * the next tick. It goes through the same source and the same door, so there is
 * no second copy of the feed path to keep in sync.
 */
async function main(): Promise<void> {
  for (const raw of fetchIssues()) {
    const created = await ingestIssue(raw);
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
