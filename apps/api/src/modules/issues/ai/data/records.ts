import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// These files ship inside the package rather than living at the repo root:
// the agent reads policies.md at runtime, so `tsc` output and any deploy that
// packages only apps/api must still resolve them. Same reasoning as the
// payments feed in ingestion/sources/data/.
const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");

export type CustomerRecord = {
  id: string;
  lifetime_spend: number;
  risk_score: string;
  [key: string]: unknown;
};

export type TransactionRecord = {
  id: string;
  customer_id: string;
  [key: string]: unknown;
};

// Read once at module load. These are immutable fixtures standing in for a
// customer service and a ledger; a real implementation queries per call.
const customers = JSON.parse(read("customers.json")) as CustomerRecord[];
const transactions = JSON.parse(read("transactions.json")) as TransactionRecord[];

export const findCustomer = (id: string): CustomerRecord | undefined =>
  customers.find((c) => c.id === id);

export const findTransaction = (id: string): TransactionRecord | undefined =>
  transactions.find((t) => t.id === id);

export const policyPath = fileURLToPath(new URL("./policies.md", import.meta.url));

// policies.md is the program, and its LINE NUMBERS are the citation anchor:
// a trace node carrying `src: 78` is quoting line 78 of this file. Lines are
// 1-indexed to match how every citation in the system is written.
const policyLines = read("policies.md").split("\n");

export const policyLineCount = policyLines.length;

export const policyLine = (n: number): string | undefined => policyLines[n - 1];
