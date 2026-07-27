import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CasePage } from "@/modules/specialists/pages/CasePage";

vi.mock("@/modules/specialists/hooks/use-case", () => ({
  useCase: () => ({
    data: {
      id: "iss_003",
      txnId: "txn_6103",
      type: "Dispute · item not received",
      amountText: "$249.00",
      tier: "High",
      crit: "high",
      status: "Investigating · yours",
      bar: {
        fillPct: 55,
        kind: "reval",
        word: "re-evaluate",
        limit: "carrier ETA Jan 14",
        elapsed: "in queue 3h",
      },
      prov: {
        mode: "manual",
        by: "operator",
        because: "escalated over $200",
        refs: [53],
      },
      history: [
        {
          actor: "virtual agent",
          t: "Jan 13 08:15",
          val: "Evaluated → recommend escalate",
        },
        { actor: "you", end: true, endCrit: "high", concl: "Your terminal decision" },
      ],
      dataGap: { html: "Missing merchant history." },
      context: {
        left: { title: "Customer", rows: [["Name", "Morgan Patel"]] },
        right: { title: "Shipping", rows: [["Merchant", "FashionForward"]] },
      },
      related: "No other open tickets for this customer.",
      rail: {
        resolve: [
          { label: "Refund customer $249", sub: "reverse the charge", variant: "go" },
          { label: "Deny dispute", sub: "tracking active" },
        ],
        other: [{ label: "Put on hold", sub: "await carrier" }],
      },
      terminalNote: "No escalate from here.",
    },
    isLoading: false,
  }),
}));

describe("CasePage", () => {
  it("renders history and the terminal decision rail", () => {
    render(<CasePage caseId="iss_003" />);
    expect(screen.getByText(/virtual agent/i)).toBeInTheDocument();
    expect(screen.getByText("Terminal decision")).toBeInTheDocument();
    expect(screen.getByText(/Refund customer/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /escalate/i }),
    ).not.toBeInTheDocument();
  });
});
