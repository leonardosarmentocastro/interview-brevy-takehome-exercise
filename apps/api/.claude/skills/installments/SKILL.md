---
name: installments
description: Procedure for missed_installment issues — missed payments on an installment plan. Use when the issue type is missed_installment.
---

# Missed installments

Governing section: `policies.md:30-41`. Read it before deciding.

| Fact | Where it comes from |
| --- | --- |
| Days overdue | the issue payload (`days_overdue`) |
| Risk score | `get_customer` → `risk_score` |
| Plans in flight | `get_customer` → `current_installment_plans` |
| Plan detail | `get_transaction` → `installment_plan` |

## Procedure

1. `:38-:41` gives three conditions for auto-resolve and ALL must hold: 3 or
   fewer days overdue, a "low" risk score, and a successful payment retry.
2. The third condition cannot be evaluated here — there is no payment
   processor to retry against. Mark it `cant_evaluate` and declare a `dataGap`.
   This is the honest answer, not a shortcoming to work around.
3. Check both escalation triggers at `:37`: more than 7 days overdue, OR
   missed payments across multiple plans. `current_installment_plans` tells you
   how many plans exist, not how many are delinquent — if the distinction
   matters to your verdict, mark it `cant_evaluate`.
