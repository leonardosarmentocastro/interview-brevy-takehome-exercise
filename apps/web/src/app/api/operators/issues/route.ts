import { NextResponse } from "next/server";
import customers from "@/modules/operators/data/fixtures/customers.json";
import transactions from "@/modules/operators/data/fixtures/transactions.json";
import issues from "@/modules/operators/data/fixtures/payment_issues.json";
import { DECISIONS } from "@/modules/operators/data/fixtures/decisions";
import { AGENT_SUMMARY } from "@/modules/operators/data/fixtures/agent-summary";
import { joinIssues } from "@/modules/operators/utils/join-issues";
import { groupByColumn } from "@/modules/operators/utils/group-by-column";
import type { Customer, Issue, Transaction } from "@/modules/operators/types";

const NOW = "2025-01-13T12:00:00Z";

export function GET() {
  const vms = joinIssues(
    {
      customers: customers as Customer[],
      transactions: transactions as Transaction[],
      issues: issues as Issue[],
    },
    DECISIONS,
    NOW,
  );
  return NextResponse.json({
    columns: groupByColumn(vms),
    agentSummary: AGENT_SUMMARY,
  });
}
