/**
 * One real agent run against the live API, for confirming SDK wiring by
 * inspection. Not part of the test suite — it costs money and needs a key.
 *
 * Usage: npm run smoke:agent
 */
import "dotenv/config";
import { runAgent } from "@/modules/issues/ai/agent/run";
import type { IssueRow } from "@/modules/issues/types";

const issue = {
  id: "00000000-0000-0000-0000-000000000004",
  externalId: "iss_004",
  type: "refund_request",
  customerId: "cust_042",
  transactionId: "txn_5998",
  amount: 149,
  merchant: "HomeEssentials",
  status: "processing",
  metadata: { reason: "changed_mind", days_since_purchase: 3, installment_plan: true },
} as unknown as IssueRow;

const decision = await runAgent(issue, {});
console.log(JSON.stringify(decision, null, 2));
