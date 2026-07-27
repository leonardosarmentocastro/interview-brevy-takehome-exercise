import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("DecisionRail", () => {
  it("does not repeat the policy verdict already shown in the main column", () => {
    render(<DecisionRail decision={decision} />);
    expect(
      screen.queryByText(/POLICY COULDN'T DECIDE/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Decision · what you do/i)).toBeInTheDocument();
  });

  it("orders escalate-to-specialist last", () => {
    render(<DecisionRail decision={decision} />);
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "");
    const actionLabels = labels.filter((l) =>
      /retry|escalate|hold/i.test(l),
    );
    expect(actionLabels.at(-1)).toMatch(/Escalate to specialist/);
  });

  it("expands the clicked option inline with a reason field", async () => {
    render(<DecisionRail decision={decision} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Schedule 3rd retry/ }),
    );
    expect(
      screen.getByText(/Schedule 3rd retry — confirm & log/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
