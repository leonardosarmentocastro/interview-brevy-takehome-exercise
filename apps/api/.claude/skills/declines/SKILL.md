---
name: declines
description: Procedure for decline issues — insufficient funds and expired card payment failures. Use when the issue type is decline.
---

# Declined payments

Governing section: `policies.md:7-26`. Read it before deciding.

Branch on the issue's `error_code`.

## insufficient_funds (`:9-:17`)

| Fact | Where it comes from |
| --- | --- |
| Retries so far | the issue payload (`auto_retry_count`) |
| Payment history | `get_customer` → `failed_payments`, `successful_payments` |

Note that `:13` ("up to 3 attempts total") and `:16` ("escalate when the third
retry fails") can disagree about whether a retry budget is exhausted, depending
on whether the original attempt counts toward the three. If the case turns on
that difference, mark both `cant_evaluate`, recommend `human_review`, and say
plainly in your reasoning that the policy is ambiguous here. That is a finding
about the document, not a failure to decide.

## card_expired (`:19-:26`)

`:26` is unambiguous: the customer must supply a new payment method, so this
cannot auto-resolve. Check `:25` for the recurring-subscription escalation
condition — `get_transaction` → `is_recurring` / `subscription`.
