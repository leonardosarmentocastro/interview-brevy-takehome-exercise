import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider, useSetAtom, useAtomValue } from "jotai";
import { SimulatorControls } from "@/modules/virtual_agents/components/SimulatorControls";
import {
  simInitAtom,
  intakeQueueAtom,
} from "@/modules/virtual_agents/data/atoms/simulator";

const snapshot = {
  stats: { resolved: 0, autoPct: 0, waiting: 0, humanReview: 0, escalated: 0 },
  resolved: { count: 0, recent: [] },
  waiting: [],
  log: [],
  intake: [],
  waitingMore: 0,
  simPool: [
    {
      id: "iss_a",
      dest: "resolved",
      meta: "…",
      destNote: "ok",
      rule: 1,
      type: "Refund",
      amountText: "$1",
    },
  ],
  simLeak: {
    id: "l",
    dest: "human_review",
    meta: "…",
    reason: "gap",
    rule: 2,
    type: "Missed",
    amountText: "$2",
  },
  drill: { total: 0, chips: [], rows: [], pattern: { count: 0, total: 0, rule: 0 } },
  analysis: {},
} as never;

function Probe() {
  return <span data-testid="q">{useAtomValue(intakeQueueAtom).length}</span>;
}
function Seed() {
  const init = useSetAtom(simInitAtom);
  useEffect(() => {
    init(snapshot);
  }, [init]);
  return null;
}

describe("SimulatorControls", () => {
  it("Poll enqueues intake cards when autoRun is off", async () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <Seed />
        <SimulatorControls autoRun={false} />
        <Probe />
      </Provider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /poll/i })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /poll/i }));
    expect(screen.getByTestId("q")).toHaveTextContent("5");
    expect(screen.getByRole("button", { name: /leak/i })).toBeInTheDocument();
  });
});
