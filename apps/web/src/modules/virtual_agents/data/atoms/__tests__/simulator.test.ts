import { describe, expect, it } from "vitest";
import { createStore } from "jotai";
import {
  simInitAtom,
  pollAtom,
  nextAtom,
  leakAtom,
  intakeQueueAtom,
  resolvedCountAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";

const snapshot = {
  stats: { resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 },
  resolved: { count: 214, recent: [] },
  waiting: [],
  log: [],
  intake: [],
  waitingMore: 0,
  simPool: [
    { id: "iss_a", dest: "resolved", meta: "iss_a · …", destNote: "retry ok", rule: 17, type: "x", amountText: "$1" },
    { id: "iss_b", dest: "waiting", meta: "iss_b · …", blocker: "⏱ retry in 2d", rule: 13, type: "y", amountText: "$2" },
  ],
  simLeak: {
    id: "iss_leak",
    dest: "human_review",
    meta: "iss_leak · …",
    reason: "day 4–7 gap",
    rule: 37,
    type: "z",
    amountText: "$3",
  },
  drill: { total: 0, chips: [], rows: [], pattern: { count: 0, total: 0, rule: 0 } },
  analysis: {},
} as never;

describe("simulator atoms", () => {
  it("poll enqueues 5 tickets", () => {
    const store = createStore();
    store.set(simInitAtom, snapshot);
    store.set(pollAtom);
    expect(store.get(intakeQueueAtom)).toHaveLength(5);
  });

  it("next() routes a resolved ticket out of intake and bumps the resolved count", () => {
    const store = createStore();
    store.set(simInitAtom, snapshot);
    store.set(pollAtom);
    const before = store.get(resolvedCountAtom);
    // first pool ticket is dest:"resolved"
    store.set(nextAtom);
    expect(store.get(intakeQueueAtom)).toHaveLength(4);
    expect(store.get(resolvedCountAtom)).toBe(before + 1);
  });

  it("leak enqueues a ticket with facts for the intake drawer", () => {
    const store = createStore();
    store.set(simInitAtom, snapshot);
    store.set(leakAtom);
    const [ticket] = store.get(intakeQueueAtom);
    expect(ticket).toMatchObject({
      type: "z",
      amountText: "$3",
      facts: {
        ticket: expect.arrayContaining([
          ["Type", "z"],
          ["Amount", "$3"],
        ]),
        customer: expect.any(Array),
      },
    });
    expect(
      "facts" in ticket && ticket.facts.ticket.length > 0 && ticket.facts.customer.length > 0,
    ).toBe(true);
  });
});
