import type { AgentSummary } from "@/modules/operators/types";

export const AGENT_SUMMARY: AgentSummary = {
  totals: { resolved: 214, waiting: 11, backlog: 2, escalated: 2 },
  categories: [
    { name: "Insufficient funds", resolved: 58, waiting: 3, backlog: 1, escalated: 0 },
    { name: "Expired card", resolved: 22, waiting: 5, backlog: 0, escalated: 0 },
    { name: "Missed installment", resolved: 31, waiting: 2, backlog: 1, escalated: 0 },
    { name: "Disputes", resolved: 9, waiting: 1, backlog: 0, escalated: 2 },
    { name: "Refunds", resolved: 94, waiting: 0, backlog: 0, escalated: 0 },
  ],
};
