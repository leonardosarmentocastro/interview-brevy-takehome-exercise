import type {
  AgentDecision,
  CitedFact,
} from "@/modules/issues/ai/agent/output-schema";
import {
  findCustomer,
  findTransaction,
  policyLine,
  policyLineCount,
} from "@/modules/issues/ai/data/records";
import type { IssueRow } from "@/modules/issues/types";

export type VerificationResult =
  | { ok: true }
  | { ok: false; mismatches: string[] };

const resolvePath = (root: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => {
    if (node === null || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, root);

// The issue's typed columns and its type-specific metadata tail are one
// namespace as far as a citation is concerned — the agent sees a single
// issue object and shouldn't have to know which fields we promoted.
const issueFacts = (issue: IssueRow): Record<string, unknown> => ({
  ...(issue.metadata as Record<string, unknown>),
  type: issue.type,
  amount: issue.amount,
  merchant: issue.merchant,
  customer_id: issue.customerId,
  transaction_id: issue.transactionId,
});

const sourceFor = (fact: CitedFact, issue: IssueRow): unknown => {
  switch (fact.source) {
    case "issue":
      return issueFacts(issue);
    case "customer":
      return findCustomer(issue.customerId);
    case "transaction":
      return findTransaction(issue.transactionId);
  }
};

const normalize = (value: unknown): string => String(value).trim().toLowerCase();

/**
 * Re-reads every fact the agent cited as evidence, straight from the source
 * record, and confirms it holds.
 *
 * The LLM still owns the decision and the reasoning. This only prevents a
 * transition when the model's own stated facts don't check out — which is
 * also how a successful prompt injection surfaces, since an agent following
 * injected instructions cites evidence that source data contradicts.
 */
export const verifyCitedFacts = (
  decision: AgentDecision,
  issue: IssueRow,
): VerificationResult => {
  const mismatches: string[] = [];

  for (const fact of decision.citedFacts) {
    const record = sourceFor(fact, issue);
    if (record === undefined) {
      mismatches.push(`${fact.source} record not found`);
      continue;
    }
    const actual = resolvePath(record, fact.path);
    if (actual === undefined) {
      mismatches.push(`${fact.source}.${fact.path} does not exist`);
      continue;
    }
    if (normalize(actual) !== normalize(fact.value)) {
      mismatches.push(
        `${fact.source}.${fact.path}: cited "${fact.value}", source has "${String(actual)}"`,
      );
    }
  }

  return mismatches.length ? { ok: false, mismatches } : { ok: true };
};

/**
 * At least one trace node must quote a real, non-empty line of policies.md.
 *
 * Injected instructions have no line number in the policy document, so this
 * is what makes "no citation, no execution" enforceable rather than aspirational.
 */
export const hasValidCitation = (decision: AgentDecision): boolean =>
  decision.trace.some((node) => {
    if (node.src < 1 || node.src > policyLineCount) return false;
    return (policyLine(node.src) ?? "").trim().length > 0;
  });
