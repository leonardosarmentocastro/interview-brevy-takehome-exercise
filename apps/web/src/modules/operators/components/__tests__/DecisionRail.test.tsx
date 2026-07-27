import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { DecisionRail } from "@/modules/operators/components/DecisionRail";

const decision = {
  why: {
    face: "no_rule",
    lead: "◆ POLICY COULDN'T DECIDE — YOUR CALL",
    because: "Policy contradicts itself.",
    ref: 13,
  },
  actions: {
    recommended: null,
    others: [
      { label: "Schedule 3rd retry", sub: "if the budget is 4 attempts", variant: "go" },
      { label: "Escalate to specialist", danger: true },
      { label: "Put on hold", sub: "pending a ruling" },
    ],
  },
  activity: [{ t: "Jan 13 03:22", text: "Ticket created", who: "system" }],
} as never;

function renderRail() {
  const store = createStore();
  return render(
    <Provider store={store}>
      <DecisionRail decision={decision} />
    </Provider>,
  );
}

describe("DecisionRail", () => {
  it("does not repeat the policy verdict already shown in the main column", () => {
    renderRail();
    expect(
      screen.queryByText(/POLICY COULDN'T DECIDE/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Decision · what you do/i)).toBeInTheDocument();
  });

  it("orders escalate-to-specialist last", () => {
    renderRail();
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");
    const actionLabels = labels.filter((l) => /retry|escalate|hold/i.test(l));
    expect(actionLabels.at(-1)).toMatch(/Escalate to specialist/);
  });

  it("expands the clicked option inline with a reason field", async () => {
    renderRail();
    await userEvent.click(
      screen.getByRole("button", { name: /Schedule 3rd retry/ }),
    );
    expect(
      screen.getByText(/Schedule 3rd retry — confirm & log/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("takes two steps: inline confirm opens a dialog, dialog confirm locks read-only", async () => {
    renderRail();
    await userEvent.click(
      screen.getByRole("button", { name: /Schedule 3rd retry/ }),
    );
    // Step 1 — inline confirm only opens the dialog; panel not yet locked.
    await userEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/moving ticket to resolved/i)).toBeInTheDocument();
    expect(screen.queryByText(/Decision taken/i)).not.toBeInTheDocument();

    // Step 2 — dialog confirm commits and locks the panel read-only.
    await userEvent.click(
      screen.getByRole("button", { name: /Confirm decision/ }),
    );
    expect(screen.getByText(/Decision taken/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Escalate to specialist/ }),
    ).not.toBeInTheDocument();
  });

  it("cancelling the dialog keeps the panel interactive", async () => {
    renderRail();
    await userEvent.click(
      screen.getByRole("button", { name: /Schedule 3rd retry/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    await userEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Decision taken/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Escalate to specialist/ }),
    ).toBeInTheDocument();
  });

  it("uses the escalation-specific message for the escalate action", async () => {
    renderRail();
    await userEvent.click(
      screen.getByRole("button", { name: /Escalate to specialist/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    expect(
      screen.getByText(/escalating to specialist's team board/i),
    ).toBeInTheDocument();
  });
});
