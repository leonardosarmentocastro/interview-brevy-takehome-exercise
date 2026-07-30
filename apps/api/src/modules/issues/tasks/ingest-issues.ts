import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { fetchIssues } from "@/modules/issues/ingestion/sources/file-source";

/**
 * The scheduled pull from the upstream system. Each new issue is inserted and
 * queued in its own transaction, so one malformed record cannot roll back the
 * batch around it.
 */
export const ingestIssues = async (): Promise<void> => {
  for (const raw of fetchIssues()) {
    await ingestIssue(raw);
  }
};
