---
name: refunds
description: Procedure for refund_request issues — buyer's remorse, changed mind, and refunds against installment plans. Use when the issue type is refund_request.
---

# Refund requests

Governing section: `policies.md:70-81`. Read it before deciding — the rules
live there, not here.

## Facts you need

| Fact | Where it comes from |
| --- | --- |
| Days since purchase | the issue payload (`days_since_purchase`). Do not recompute it from `created_at` — the corpus has fixed dates and that comparison is always wrong. |
| Whether the item shipped | `get_transaction` → `shipping.status`. Never the issue payload. |
| Installment plan | `get_transaction` → `installment_plan` |
| Lifetime spend | `get_customer` → `lifetime_spend` |

## Procedure

1. Check the eligibility window and the shipping status. Both are required for
   the `:78` auto-resolve condition — one alone is not enough.
2. If the transaction carries an installment plan, `:79` changes what the
   refund covers. Say so in your reasoning.
3. Check `:88` — a high-value customer warrants extra care even on a clean case.
4. If shipping data is absent, declare a `dataGap` rather than assuming the
   item has not shipped.
5. Confidence on a clean case: when both halves of `:78` are verified from
   source data (payload `days_since_purchase` inside the window, and
   `get_transaction` → `shipping.status` is `not_shipped`), no escalation
   trigger fires, and lifetime spend is under the `:88` threshold, this is a
   fully checkable auto-resolve — report confidence **at or above 0.90**.
   Holding back below 0.90 on a case with no remaining uncertainty parks a
   decision that policy already authorises.

## Cite

Every rule you apply gets a trace entry with its `policies.md` line. Restate
the shipping status and the day count in `citedFacts` — both are checked
against source data.
