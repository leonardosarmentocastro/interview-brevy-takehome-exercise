import { NextResponse } from "next/server";
import customers from "@/modules/operators/data/fixtures/customers.json";
import transactions from "@/modules/operators/data/fixtures/transactions.json";
import issues from "@/modules/operators/data/fixtures/payment_issues.json";
import { DECISIONS } from "@/modules/operators/data/fixtures/decisions";
import { joinIssues } from "@/modules/operators/utils/join-issues";
import type { Customer, Issue, Transaction } from "@/modules/operators/types";

const NOW = "2025-01-13T12:00:00Z";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const vm = joinIssues(
    {
      customers: customers as Customer[],
      transactions: transactions as Transaction[],
      issues: issues as Issue[],
    },
    DECISIONS,
    NOW,
  ).find((v) => v.issue.id === id);
  if (!vm) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(vm);
}
