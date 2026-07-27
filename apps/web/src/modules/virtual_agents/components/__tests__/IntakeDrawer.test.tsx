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

  it("renders synthesized facts from an injected simulator ticket", () => {
    render(
      <IntakeDrawer
        item={{
          id: "sim_leak_1",
          type: "Missed installment",
          amountText: "$58.00",
          facts: {
            ticket: [
              ["Type", "Missed installment"],
              ["Amount", "$58.00"],
              ["Policy gap", "day 4–7 gap"],
            ],
            customer: [
              ["Context", "sim_leak_1 · plan 3/4 · day 5"],
              ["Source", "Simulator"],
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("sim_leak_1")).toBeInTheDocument();
    expect(screen.getByText("day 4–7 gap")).toBeInTheDocument();
    expect(screen.getByText("Simulator")).toBeInTheDocument();
  });
});
