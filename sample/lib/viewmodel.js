const TYPE_LABEL = {
  decline: 'Decline',
  missed_installment: 'Missed installment',
  dispute: 'Dispute',
  refund_request: 'Refund request',
};

const HIGH_VALUE_THRESHOLD = 2000;

export function daysBetween(laterISO, earlierISO) {
  const ms = new Date(laterISO).getTime() - new Date(earlierISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const money = (n) => '$' + Number(n).toFixed(2);

export function joinIssues(fixtures, decisions, nowISO) {
  const custById = new Map(fixtures.customers.map((c) => [c.id, c]));
  const txnById = new Map(fixtures.transactions.map((t) => [t.id, t]));

  return fixtures.issues.map((issue) => {
    const customer = custById.get(issue.customer_id) || null;
    const transaction = txnById.get(issue.transaction_id) || null;
    const decision = decisions[issue.id] || null;
    // Prefer issue.days_since_purchase when present (calendar age on the ticket);
    // otherwise floored days from transaction/issue timestamps.
    const ageDays = issue.days_since_purchase != null
      ? Number(issue.days_since_purchase)
      : daysBetween(nowISO, (transaction && transaction.created_at) || issue.created_at);
    const lifetimeSpend = customer ? customer.lifetime_spend : 0;

    return {
      issue,
      transaction,
      customer,
      decision,
      display: {
        id: issue.id,
        txnId: issue.transaction_id,
        typeLabel: TYPE_LABEL[issue.type] || issue.type,
        amount: issue.amount,
        amountText: money(issue.amount),
        customerName: customer ? customer.name : issue.customer_id,
        custId: issue.customer_id,
        merchant: issue.merchant || (transaction ? transaction.merchant : ''),
        ageDays,
        riskScore: customer ? customer.risk_score : 'unknown',
        lifetimeSpend,
        isHighValue: lifetimeSpend > HIGH_VALUE_THRESHOLD,
      },
    };
  });
}

const COLUMNS = ['needs_review', 'in_review', 'on_hold', 'resolved'];

export function groupByColumn(viewModels) {
  const grouped = Object.fromEntries(COLUMNS.map((c) => [c, []]));
  for (const vm of viewModels) {
    const lane = vm.decision && vm.decision.lane;
    if (grouped[lane]) grouped[lane].push(vm);
  }
  return grouped;
}
