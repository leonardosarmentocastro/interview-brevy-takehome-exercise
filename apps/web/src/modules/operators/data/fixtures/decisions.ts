import type { Decision } from "@/modules/operators/types";

// STATIC decision layer. Hand-authored, traced to policies.md by line number.
export const DECISIONS: Record<string, Decision> = {
  iss_003: {
    lane: "in_review",
    owner: "me",
    typeLabelOverride: "Dispute · item not received",
    statusLabel: "In review · yours",
    urgency: { level: "soon", label: "⏱ carrier ETA Jan 14" },
    why: {
      face: "escalate",
      lead: "▲ RECOMMEND ESCALATE TO SPECIALIST",
      because:
        "Dispute amount $249 exceeds the $200 escalation trigger — a standard operator can't clear this.",
      ref: 53,
    },
    trace: [
      {
        src: 51,
        status: "not_met",
        rule: 'Auto-resolve if tracking shows "delivered" + 3 days.',
        evidence: "Parcel is in transit → can't auto-resolve.",
      },
      {
        src: 53,
        status: "fired",
        rule: "Escalate if amount > $200.",
        evidence: "$249 → triggers escalation.",
      },
      {
        src: 54,
        status: "not_met",
        rule: "Escalate if lifetime spend > $2000.",
        evidence: "Morgan is at $312 → no.",
      },
      {
        src: 55,
        status: "cant_evaluate",
        rule: "Escalate if merchant has fulfillment history.",
        evidence: "No merchant data exists — see gap below.",
      },
    ],
    dataGap: {
      text: "Rules :55 and :56 need merchant history, delivery-confirmation events and comms history. None exist in the dataset. The verdict holds because :53 fires — but the policy references data we don't have.",
    },
    related: [],
    actions: {
      recommended: {
        label: "▲ Escalate to specialist",
        sub: "amount over $200 · policies.md:53",
        variant: "esc",
      },
      others: [
        { label: "Put on hold", sub: "wait on carrier · until Jan 14" },
        { label: "Resolve manually…", sub: "refund or deny" },
      ],
    },
    activity: [
      { t: "Jan 13 08:15", text: "Ticket created from txn_6103", who: "system" },
      {
        t: "Jan 13 08:15",
        text: "Agent evaluated → recommend escalate (:53)",
        who: "virtual agent",
      },
      { t: "Jan 13 08:15", text: "Sent to team backlog", who: "virtual agent" },
      { t: "Jan 13 11:02", text: "Picked up → In review", who: "you" },
    ],
  },

  iss_001: {
    lane: "needs_review",
    owner: "team",
    typeLabelOverride: "Insufficient funds",
    statusLabel: "Needs review",
    urgency: { level: "none", label: "⏱ no clock — count disputed" },
    why: {
      face: "no_rule",
      lead: "◆ POLICY COULDN'T DECIDE — YOUR CALL",
      because:
        'Policy contradicts itself: "3 attempts total" (:13) vs "third retry fails" (:16).',
      ref: 13,
    },
    trace: [
      {
        src: 13,
        status: "cant_evaluate",
        rule: "Auto-retry: up to 3 attempts total.",
        evidence: "Original + 2 retries = 3 → reads as exhausted.",
      },
      {
        src: 16,
        status: "cant_evaluate",
        rule: "Escalate when the third retry fails.",
        evidence: "Only 2 retries so far → reads as one still owed.",
      },
    ],
    dataGap: null,
    related: ["iss_004"],
    actions: {
      recommended: null,
      others: [
        {
          label: "Schedule 3rd retry",
          sub: "if the budget is 4 attempts",
          variant: "go",
        },
        { label: "Escalate to specialist", danger: true },
        { label: "Put on hold", sub: "pending a ruling" },
      ],
    },
    activity: [
      { t: "Jan 13 03:22", text: "Ticket created from txn_5521", who: "system" },
      {
        t: "Jan 13 03:22",
        text: "Agent could not decide — clauses contradict",
        who: "virtual agent",
      },
      {
        t: "Jan 13 03:22",
        text: "Auto-promoted to team backlog (no rule)",
        who: "virtual agent",
      },
    ],
  },

  iss_002: {
    lane: "needs_review",
    owner: "team",
    typeLabelOverride: "Missed installment",
    statusLabel: "Needs review",
    urgency: { level: "soon", label: "⏱ escalates in 2 days (day 7)" },
    why: {
      face: "no_rule",
      lead: "◆ POLICY COULDN'T DECIDE — YOUR CALL",
      because:
        "Auto-resolve stops at day 3 (:39); escalation starts at day 8 (:37). Day 5 is covered by no rule.",
      ref: 37,
    },
    trace: [
      {
        src: 39,
        status: "not_met",
        rule: "Auto-resolve if ≤ 3 days overdue.",
        evidence: "Day 5 → not satisfied.",
      },
      {
        src: 37,
        status: "not_met",
        rule: "Escalate if more than 7 days overdue.",
        evidence: "Day 5 → not satisfied either. No rule covers day 5.",
      },
    ],
    dataGap: null,
    related: [],
    actions: {
      recommended: null,
      others: [
        { label: "Retry payment" },
        { label: "Modify plan schedule…", sub: "new dates / amounts" },
        { label: "Pause plan", sub: "stop the clock" },
        { label: "Escalate to specialist", danger: true },
      ],
    },
    activity: [
      { t: "Jan 12 00:00", text: "Ticket created from txn_4892", who: "system" },
      {
        t: "Jan 12 00:00",
        text: "Day-5 range not covered by any rule",
        who: "virtual agent",
      },
      {
        t: "Jan 12 00:00",
        text: "Auto-promoted to team backlog (no rule)",
        who: "virtual agent",
      },
    ],
  },
};
