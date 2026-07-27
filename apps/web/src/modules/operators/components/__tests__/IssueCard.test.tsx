import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueCard } from "@/modules/operators/components/IssueCard";
import type { IssueViewModel } from "@/modules/operators/types";

const vm = {
  issue: { id: "iss_003" },
  display: {
    id: "iss_003",
    typeLabel: "Dispute",
    amountText: "$249.00",
    customerName: "Morgan L.",
    merchant: "HomeEssentials",
    ageDays: 3,
    isHighValue: false,
  },
} as unknown as IssueViewModel;

describe("IssueCard", () => {
  it("shows the issue summary and links to its detail route", () => {
    render(<IssueCard vm={vm} />);
    expect(screen.getByText("$249.00")).toBeInTheDocument();
    expect(screen.getByText(/Morgan L\./)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/boards/operators/iss_003",
    );
  });
});
