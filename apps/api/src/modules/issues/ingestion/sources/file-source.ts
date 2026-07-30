import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createIssueSchema,
  type CreateIssueInput,
} from "@/modules/issues/schema";

// The feed ships inside the package, not in repo-root docs/, so `tsc` output
// and any deploy that packages only apps/api still resolve it.
const dataPath = fileURLToPath(
  new URL("./data/payment_issues.json", import.meta.url),
);

/**
 * Stands in for the upstream payments platform.
 *
 * Reads the whole feed every call rather than tracking a watermark. That is
 * only safe because ingestion dedupes on the source's own id — a real API
 * needs a cursor, since it cannot re-fetch all history every minute.
 */
export const fetchIssues = (): CreateIssueInput[] => {
  const raw = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  return raw.map((issue) => createIssueSchema.parse(issue));
};
