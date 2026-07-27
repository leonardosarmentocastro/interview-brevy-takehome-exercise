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

  it("styles escalate recommendation and CTA in red, not green go", () => {
    const escalateVm = {
      ...vm,
      decision: {
        why: {
          face: "escalate",
          lead: "▲ RECOMMEND ESCALATE TO SPECIALIST",
          because: "Dispute amount exceeds trigger.",
          ref: 53,
        },
        actions: {
          recommended: {
            label: "▲ Escalate to specialist",
            sub: "amount over $200",
          },
          others: [],
        },
        urgency: { level: "soon", label: "⏱ carrier ETA Jan 14" },
      },
    } as unknown as IssueViewModel;

    const { container } = render(<IssueCard vm={escalateVm} />);
    expect(
      screen.getByText(/RECOMMEND ESCALATE TO SPECIALIST/i),
    ).toBeInTheDocument();
    const escBtn = screen.getByText(/^Escalate to specialist$/);
    expect(escBtn.className).toMatch(/\besc\b/);
    expect(escBtn.className).not.toMatch(/\bgo\b/);
    expect(container.querySelector(".chip.esc")).not.toBeNull();
  });
});
