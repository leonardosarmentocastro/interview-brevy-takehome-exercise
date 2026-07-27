import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrillPage } from "@/modules/virtual_agents/pages/DrillPage";

vi.mock("@/modules/virtual_agents/hooks/use-monitor", () => ({
  useMonitor: () => ({
    data: {
      drill: {
        total: 2,
        chips: [
          { cat: "all", label: "All", n: 2 },
          { cat: "refund", label: "Refunds", n: 1 },
        ],
        rows: [
          {
            id: "iss_004",
            cat: "refund",
            type: "Refund",
            amountText: "$149.00",
            customer: "Morgan L.",
            time: "10:42:05",
            rule: 77,
            analysis: "iss_004",
            txt: "iss_004 morgan",
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
            txt: "iss_060 dana",
          },
        ],
        pattern: { count: 1, total: 2, rule: 77 },
      },
      analysis: {},
    },
  }),
}));

describe("DrillPage", () => {
  it("filters rows when a category chip is chosen", async () => {
    render(<DrillPage />);
    expect(screen.getByText("iss_004")).toBeInTheDocument();
    expect(screen.getByText("iss_060")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /refunds/i }));
    expect(screen.getByText("iss_004")).toBeInTheDocument();
    expect(screen.queryByText("iss_060")).not.toBeInTheDocument();
  });
});
