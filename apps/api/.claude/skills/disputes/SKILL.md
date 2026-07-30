---
name: disputes
description: Procedure for dispute issues — item not received and unauthorized transaction claims. Use when the issue type is dispute.
---

# Disputes

Governing section: `policies.md:45-66`. Read it before deciding.

There are two distinct kinds and they behave very differently. Check the
issue's `reason` field first.

## Unauthorized transaction (fraud)

`:63` is unambiguous: never auto-resolve. Recommend `escalate` and cite `:63`.
Do not spend turns gathering context to argue otherwise.

## Item not received

| Fact | Where it comes from |
| --- | --- |
| Tracking status and delivery date | `get_transaction` → `shipping` |
| Dispute amount | the issue payload (`amount`) |
| Lifetime spend | `get_customer` → `lifetime_spend` |

1. Check the `:51` auto-resolve condition: tracking shows delivered AND 3+ days
   have passed since delivery.
2. Walk every escalation trigger at `:53-:55` — amount, high-value customer,
   merchant fulfilment history.
3. Merchant fulfilment history does not exist in this dataset. Mark `:55`
   `cant_evaluate` and declare a `dataGap`; do not guess.
