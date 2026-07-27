import type {
  Customer,
  Decision,
  Issue,
  IssueViewModel,
  Transaction,
} from "@/modules/operators/types";
import { daysBetween } from "@/modules/operators/utils/days-between";
import { formatMoney } from "@/modules/operators/utils/format-money";

const TYPE_LABEL: Record<string, string> = {
  decline: "Decline",
  missed_installment: "Missed installment",
  dispute: "Dispute",
  refund_request: "Refund request",
};

const HIGH_VALUE_THRESHOLD = 2000;

export function joinIssues(
  fixtures: {
    customers: Customer[];
    transactions: Transaction[];
    issues: Issue[];
  },
  decisions: Record<string, Decision>,
  nowISO: string,
): IssueViewModel[] {
  const custById = new Map(fixtures.customers.map((c) => [c.id, c]));
  const txnById = new Map(fixtures.transactions.map((t) => [t.id, t]));

  return fixtures.issues.map((issue) => {
    const customer = custById.get(issue.customer_id) || null;
    const transaction = txnById.get(issue.transaction_id) || null;
    const decision = decisions[issue.id] || null;
    const ageDays =
      issue.days_since_purchase != null
        ? Number(issue.days_since_purchase)
        : daysBetween(
            nowISO,
            (transaction && transaction.created_at) || issue.created_at,
          );
    const lifetimeSpend = customer ? customer.lifetime_spend : 0;
    const amount = issue.amount ?? issue.amount_due ?? 0;

    return {
      issue,
      transaction,
      customer,
      decision,
      display: {
        id: issue.id,
        txnId: issue.transaction_id,
        typeLabel: TYPE_LABEL[issue.type] || issue.type,
        amount,
        amountText: formatMoney(amount),
        customerName: customer ? customer.name : issue.customer_id,
        custId: issue.customer_id,
        merchant: issue.merchant || (transaction ? transaction.merchant : ""),
        ageDays,
        riskScore: customer ? customer.risk_score : "unknown",
        lifetimeSpend,
        isHighValue: lifetimeSpend > HIGH_VALUE_THRESHOLD,
      },
    };
  });
}
