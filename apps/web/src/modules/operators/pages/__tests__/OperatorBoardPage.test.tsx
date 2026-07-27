import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperatorBoardPage } from "@/modules/operators/pages/OperatorBoardPage";

vi.mock("@/modules/operators/hooks/use-issues", () => ({
  useIssues: () => ({
    data: {
      columns: {
        needs_review: [
          {
            issue: { id: "iss_1" },
            display: {
              id: "iss_1",
              typeLabel: "Decline",
              amountText: "$45.00",
              customerName: "Dana K.",
              merchant: "TechGadgets",
              ageDays: 1,
              isHighValue: false,
            },
          },
        ],
        in_review: [],
        on_hold: [],
        resolved: [],
      },
      agentSummary: {
        totals: { resolved: 214, waiting: 11, backlog: 2, escalated: 2 },
        categories: [],
      },
    },
    isLoading: false,
  }),
}));

describe("OperatorBoardPage", () => {
  it("renders the four lanes and places cards by column", () => {
    render(<OperatorBoardPage />);
    expect(screen.getByRole("heading", { name: /needs review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /in review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /on hold/i })).toBeInTheDocument();
    expect(screen.getByText("$45.00")).toBeInTheDocument();
  });

  it("does not render the Virtual agent — today summary", () => {
    render(<OperatorBoardPage />);
    expect(
      screen.queryByRole("heading", { name: /Virtual agent — today/i }),
    ).not.toBeInTheDocument();
  });
});
