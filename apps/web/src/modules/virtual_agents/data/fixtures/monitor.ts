import type { MonitorSnapshot } from '@/modules/virtual_agents/types';

export const MONITOR: MonitorSnapshot = {
  stats: {
    resolved: 214,
    autoPct: 95,
    waiting: 11,
    humanReview: 2,
    escalated: 2
  },
  log: [
    {
      t: "10:42:07",
      kind: "grab",
      text: "grabbed <b>iss_061</b> for analysis",
      refs: []
    },
    {
      t: "10:42:05",
      kind: "resolved",
      text: "<b>iss_004</b> resolved automatically — refund within 14d, item not shipped",
      refs: [
        77
      ]
    },
    {
      t: "10:41:58",
      kind: "grab",
      text: "<b>iss_005</b> nudge sent to customer — expired card, 48h window opened",
      refs: [
        24
      ]
    },
    {
      t: "10:41:30",
      kind: "leak",
      text: "<b>iss_002</b> — policy couldn’t decide (day 4–7 gap) → sent for human review",
      refs: [
        37
      ]
    },
    {
      t: "10:41:12",
      kind: "grab",
      text: "<b>iss_048</b> retry scheduled — insufficient funds, attempt 2 of 3, next in 2d",
      refs: [
        13
      ]
    },
    {
      t: "10:40:55",
      kind: "leak",
      text: "<b>iss_001</b> — policy couldn’t decide (3-vs-4 retry contradiction) → sent for human review",
      refs: [
        13,
        16
      ]
    },
    {
      t: "10:40:31",
      kind: "escalated",
      text: "<b>iss_003</b> escalated to specialist — dispute $249 exceeds $200",
      refs: [
        53
      ]
    }
  ],
  intake: [
    {
      id: "iss_061",
      type: "Insufficient funds",
      amountText: "$128.00",
      meta: "iss_061 · Dana K. · TechGadgets.com · just now",
      facts: {
        ticket: [
          [
            "Type",
            "decline · insufficient_funds"
          ],
          [
            "Amount",
            "$128.00"
          ],
          [
            "Merchant",
            "TechGadgets.com"
          ],
          [
            "Auto-retry count",
            "1"
          ],
          [
            "Arrived",
            "2025-01-13 10:42 (from vendor feed)"
          ]
        ],
        customer: [
          [
            "Name",
            "Dana K. · cust_071"
          ],
          [
            "Risk score",
            "low"
          ],
          [
            "Lifetime spend",
            "$742.00 · 9 transactions"
          ],
          [
            "Account since",
            "2024-03-11"
          ]
        ]
      }
    },
    {
      id: "iss_062",
      type: "Refund — changed mind",
      amountText: "$54.00",
      meta: "iss_062 · Alex M. · HomeEssentials · just now",
      facts: {
        ticket: [
          [
            "Type",
            "refund_request · changed_mind"
          ],
          [
            "Amount",
            "$54.00"
          ],
          [
            "Merchant",
            "HomeEssentials"
          ],
          [
            "Days since purchase",
            "2"
          ],
          [
            "Arrived",
            "2025-01-13 10:42 (from vendor feed)"
          ]
        ],
        customer: [
          [
            "Name",
            "Alex M. · cust_088"
          ],
          [
            "Risk score",
            "low"
          ],
          [
            "Lifetime spend",
            "$355.00 · 4 transactions"
          ],
          [
            "Account since",
            "2024-09-02"
          ]
        ]
      }
    }
  ],
  waiting: [
    {
      id: "iss_005",
      type: "Expired card",
      amountText: "$34.99",
      meta: "iss_005 · Priya S. · SubscriptionBox.co · recurring",
      blocker: "✉ nudge sent — awaiting customer · 48h window"
    },
    {
      id: "iss_048",
      type: "Insufficient funds",
      amountText: "$89.99",
      meta: "iss_048 · Sam T. · TechGadgets.com · attempt 2 of 3",
      blocker: "⏱ retry in 2d"
    },
    {
      id: "iss_051",
      type: "Missed installment",
      amountText: "$62.50",
      meta: "iss_051 · Jordan P. · plan 3/4 · 2d overdue",
      blocker: "⏳ grace ends in 5d (day 7)"
    }
  ],
  waitingMore: 8,
  resolved: {
    count: 214,
    recent: [
      {
        id: "iss_004",
        typeShort: "refund",
        note: "within 14d"
      },
      {
        id: "iss_060",
        typeShort: "insuff. funds",
        note: "retry ok"
      },
      {
        id: "iss_059",
        typeShort: "refund",
        note: "within 14d"
      },
      {
        id: "iss_058",
        typeShort: "missed inst.",
        note: "day 2, retried"
      },
      {
        id: "iss_057",
        typeShort: "refund",
        note: "within 14d"
      }
    ]
  },
  drill: {
    total: 214,
    chips: [
      {
        cat: "all",
        label: "All",
        n: 214
      },
      {
        cat: "refund",
        label: "Refunds",
        n: 94
      },
      {
        cat: "decline",
        label: "Insufficient funds",
        n: 58
      },
      {
        cat: "missed",
        label: "Missed installments",
        n: 31
      }
    ],
    rows: [
      {
        id: "iss_004",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$149.00",
        customer: "Morgan L.",
        time: "10:42:05",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_004 morgan homeessentials"
      },
      {
        id: "iss_060",
        cat: "decline",
        type: "Insufficient funds",
        amountText: "$45.00",
        customer: "Dana K.",
        time: "10:41:40",
        rule: 17,
        analysis: "iss_060",
        txt: "iss_060 dana techgadgets"
      },
      {
        id: "iss_059",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$88.00",
        customer: "Lee W.",
        time: "10:40:12",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_059 lee shopmart"
      },
      {
        id: "iss_058",
        cat: "missed",
        type: "Missed installment",
        amountText: "$30.00",
        customer: "Kai R.",
        time: "10:39:55",
        rule: 38,
        analysis: "iss_058",
        txt: "iss_058 kai planpay"
      },
      {
        id: "iss_057",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$210.00",
        customer: "Nadia S.",
        time: "10:38:30",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_057 nadia fashionforward"
      },
      {
        id: "iss_055",
        cat: "missed",
        type: "Missed installment",
        amountText: "$62.50",
        customer: "Omar T.",
        time: "10:37:02",
        rule: 38,
        analysis: "iss_058",
        txt: "iss_055 omar planpay"
      },
      {
        id: "iss_052",
        cat: "decline",
        type: "Insufficient funds",
        amountText: "$73.20",
        customer: "Dana K.",
        time: "10:35:48",
        rule: 17,
        analysis: "iss_060",
        txt: "iss_052 dana techgadgets"
      },
      {
        id: "iss_050",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$120.00",
        customer: "Priya S.",
        time: "10:34:11",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_050 priya homeessentials"
      },
      {
        id: "iss_047",
        cat: "missed",
        type: "Missed installment",
        amountText: "$40.00",
        customer: "Sam T.",
        time: "10:32:39",
        rule: 38,
        analysis: "iss_058",
        txt: "iss_047 sam planpay"
      },
      {
        id: "iss_045",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$65.00",
        customer: "Morgan L.",
        time: "10:30:05",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_045 morgan shopmart"
      },
      {
        id: "iss_040",
        cat: "decline",
        type: "Insufficient funds",
        amountText: "$99.00",
        customer: "Jordan P.",
        time: "10:27:51",
        rule: 17,
        analysis: "iss_060",
        txt: "iss_040 jordan techgadgets"
      },
      {
        id: "iss_038",
        cat: "refund",
        type: "Refund — changed mind",
        amountText: "$150.00",
        customer: "Nadia S.",
        time: "10:25:20",
        rule: 77,
        analysis: "iss_004",
        txt: "iss_038 nadia fashionforward"
      }
    ],
    pattern: {
      count: 92,
      total: 214,
      rule: 77
    }
  },
  analysis: {
    iss_004: {
      id: "iss_004",
      txnId: "txn_5998",
      resolvedAt: "10:42:05",
      type: "Refund — changed mind",
      amountText: "$149.00",
      rec: {
        lead: "✓ AUTO-RESOLVED — refund approved",
        because: "Within the 14-day window (<b>day 3</b>) and the item <b>hasn’t shipped</b> — both conditions for auto-resolve are met, so no human was needed.",
        ref: 77
      },
      trace: [
        {
          src: 77,
          status: "fired",
          rule: "Auto-resolve if within 14 days AND item hasn’t shipped.",
          evidence: "Purchased 3 days ago · shipping status = not_shipped → both true."
        },
        {
          src: 79,
          status: "applied",
          rule: "Installment plans: refund paid installments; cancel remaining.",
          evidence: "1 of 4 paid → refund the paid portion, cancel the rest of the plan."
        }
      ],
      conclusion: "→ Refund approved automatically · no human involved",
      context: [
        [
          "Customer",
          "Morgan L. · cust_042 · risk low"
        ],
        [
          "Merchant",
          "HomeEssentials"
        ],
        [
          "Purchased",
          "2025-01-10 (3 days ago)"
        ],
        [
          "Plan",
          "installments 1 / 4 paid"
        ]
      ],
      audit: "<b>who:</b> virtual agent · <b>when:</b> 10:42:05 · <b>action:</b> auto-resolve refund · <b>reason:</b> policies.md:77 · <b>policy version:</b> v1"
    },
    iss_060: {
      id: "iss_060",
      txnId: "txn_6210",
      resolvedAt: "10:41:40",
      type: "Insufficient funds",
      amountText: "$45.00",
      rec: {
        lead: "✓ AUTO-RESOLVED — retry succeeded",
        because: "A scheduled retry cleared within the 3-attempt budget, so the charge went through with no human needed.",
        ref: 17
      },
      trace: [
        {
          src: 13,
          status: "applied",
          rule: "Auto-retry: up to 3 attempts total.",
          evidence: "Attempt 2 scheduled and executed within budget."
        },
        {
          src: 17,
          status: "fired",
          rule: "Resolves on a successful retry.",
          evidence: "Retry authorised → balance captured."
        }
      ],
      conclusion: "→ Charge captured automatically · no human involved",
      context: [
        [
          "Customer",
          "Dana K. · cust_071 · risk low"
        ],
        [
          "Merchant",
          "TechGadgets.com"
        ],
        [
          "Attempts",
          "2 of 3"
        ]
      ],
      audit: "<b>who:</b> virtual agent · <b>when:</b> 10:41:40 · <b>action:</b> retry captured · <b>reason:</b> policies.md:17 · <b>policy version:</b> v1"
    },
    iss_058: {
      id: "iss_058",
      txnId: "txn_6188",
      resolvedAt: "10:39:55",
      type: "Missed installment",
      amountText: "$30.00",
      rec: {
        lead: "✓ AUTO-RESOLVED — installment retried",
        because: "Only <b>2 days</b> overdue, customer risk is <b>low</b>, and the retry succeeded — all three auto-resolve conditions are met.",
        ref: 38
      },
      trace: [
        {
          src: 38,
          status: "fired",
          rule: "Auto-resolve if ≤3 days overdue AND low risk AND retry succeeds.",
          evidence: "Day 2 · risk low · retry authorised → all true."
        }
      ],
      conclusion: "→ Installment captured automatically · no human involved",
      context: [
        [
          "Customer",
          "Kai R. · cust_133 · risk low"
        ],
        [
          "Plan",
          "installment 2 / 4"
        ],
        [
          "Overdue",
          "2 days"
        ]
      ],
      audit: "<b>who:</b> virtual agent · <b>when:</b> 10:39:55 · <b>action:</b> installment retried · <b>reason:</b> policies.md:38 · <b>policy version:</b> v1"
    }
  },
  simPool: [
    {
      id: "sim_a",
      type: "Refund — changed mind",
      amountText: "$40.00",
      meta: "refund · not shipped · just now",
      dest: "resolved",
      destNote: "within 14d, not shipped",
      rule: 77
    },
    {
      id: "sim_b",
      type: "Insufficient funds",
      amountText: "$76.00",
      meta: "decline · attempt 1 · just now",
      dest: "waiting",
      blocker: "⏱ retry in 2d",
      rule: 13
    },
    {
      id: "sim_c",
      type: "Missed installment",
      amountText: "$52.00",
      meta: "plan 2/4 · day 1 · just now",
      dest: "resolved",
      destNote: "day 1, low risk, retried",
      rule: 38
    },
    {
      id: "sim_d",
      type: "Expired card",
      amountText: "$19.99",
      meta: "recurring · just now",
      dest: "waiting",
      blocker: "✉ nudge sent — awaiting customer · 48h window",
      rule: 24
    },
    {
      id: "sim_e",
      type: "Refund — changed mind",
      amountText: "$61.00",
      meta: "refund · not shipped · just now",
      dest: "resolved",
      destNote: "within 14d, not shipped",
      rule: 77
    },
    {
      id: "sim_f",
      type: "Insufficient funds",
      amountText: "$104.00",
      meta: "decline · attempt 1 · just now",
      dest: "resolved",
      destNote: "retry succeeded",
      rule: 17
    }
  ],
  simLeak: {
    id: "sim_leak",
    type: "Missed installment",
    amountText: "$58.00",
    meta: "plan 3/4 · day 5 · just now",
    dest: "human_review",
    reason: "day 4–7 gap",
    rule: 37
  }
};
