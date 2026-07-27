import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntakeDrawer } from "@/modules/virtual_agents/components/IntakeDrawer";

const item = {
  id: "iss_061",
  type: "Insufficient funds",
  amountText: "$128.00",
  meta: "…",
  facts: {
    ticket: [
      ["Amount", "$128.00"],
      ["Merchant", "TechGadgets.com"],
    ],
    customer: [["Risk score", "low"]],
  },
} as never;

describe("IntakeDrawer", () => {
  it("renders ticket + customer fact rows", () => {
    render(<IntakeDrawer item={item} />);
    expect(screen.getByText("TechGadgets.com")).toBeInTheDocument();
    expect(screen.getByText("Risk score")).toBeInTheDocument();
  });
});
