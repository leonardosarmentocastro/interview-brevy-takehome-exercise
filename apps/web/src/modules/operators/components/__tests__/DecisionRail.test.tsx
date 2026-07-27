import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DecisionRail } from "@/modules/operators/components/DecisionRail";

const decision = {
  why: {
    face: "escalate",
    lead: "▲ RECOMMEND ESCALATE TO SPECIALIST",
    because: "Dispute amount $249 exceeds the $200 trigger.",
    ref: 53,
  },
  actions: {
    recommended: {
      label: "▲ Escalate to specialist",
      sub: "amount over $200",
      variant: "esc",
    },
    others: [{ label: "Put on hold", sub: "wait on carrier" }],
  },
} as never;

describe("DecisionRail", () => {
  it("renders the recommendation, rationale, and policy ref", () => {
    render(<DecisionRail decision={decision} />);
    expect(screen.getByText(/RECOMMEND ESCALATE/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /policies\.md:53/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Escalate to specialist/)).toBeInTheDocument();
  });
});
