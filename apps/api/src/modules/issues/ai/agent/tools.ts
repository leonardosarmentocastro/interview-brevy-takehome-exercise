import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  findCustomer,
  findTransaction,
} from "@/modules/issues/ai/data/records";

// `createSdkMcpServer` runs IN-PROCESS — no server, no network, no config
// file. MCP is just the protocol the SDK speaks internally; these are plain
// TypeScript functions with a schema attached.
//
// Chosen over letting the agent Read the fixture files because it gives:
// narrow access (one record by id, so less untrusted text enters context),
// an audit trail (every data access is a logged tool call), and a seam where
// a real customer service later replaces a fixture read without the agent
// contract changing.

type ToolResult = { content: { type: "text"; text: string }[] };

const json = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

// A miss is reported, not thrown: a thrown tool error ends the run, whereas a
// reported miss lets the agent declare a data gap — a decision we can score.
export const getCustomerHandler = async ({
  id,
}: {
  id: string;
}): Promise<ToolResult> =>
  json(findCustomer(id) ?? { error: `customer ${id} not found` });

export const getTransactionHandler = async ({
  id,
}: {
  id: string;
}): Promise<ToolResult> =>
  json(findTransaction(id) ?? { error: `transaction ${id} not found` });

export const PAYMENTS_TOOL_NAMES = [
  "mcp__payments__get_customer",
  "mcp__payments__get_transaction",
];

export const paymentsTools = createSdkMcpServer({
  name: "payments",
  version: "1.0.0",
  instructions:
    "Read-only access to customer profiles and transaction records. Use these rather than assuming any fact about a customer or a transaction.",
  tools: [
    tool(
      "get_customer",
      "Fetch one customer profile by id. Returns lifetime spend, risk score, dispute history and payment counts.",
      { id: z.string() },
      getCustomerHandler,
    ),
    tool(
      "get_transaction",
      "Fetch one transaction by id. Returns amount, status, shipping (carrier, tracking, status) and any installment plan.",
      { id: z.string() },
      getTransactionHandler,
    ),
  ],
});
