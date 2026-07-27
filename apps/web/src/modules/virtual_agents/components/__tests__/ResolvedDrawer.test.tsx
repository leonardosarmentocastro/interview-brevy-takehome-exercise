import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResolvedDrawer } from "@/modules/virtual_agents/components/ResolvedDrawer";
import type { AnalysisRecord } from "@/modules/virtual_agents/types";

const analysis: AnalysisRecord = {
  id: "iss_004",
  txnId: "txn_5998",
  resolvedAt: "10:42:05",
  type: "Refund — changed mind",
  amountText: "$149.00",
  rec: {
    lead: "✓ AUTO-RESOLVED — refund approved",
    because: "Within the 14-day window (<b>day 3</b>).",
    ref: 77,
  },
  trace: [
    {
      src: 77,
      status: "fired",
      rule: "Auto-resolve if within 14 days AND item hasn’t shipped.",
      evidence:
        "Purchased 3 days ago · shipping status = not_shipped → both true.",
    },
    {
      src: 79,
      status: "applied",
      rule: "Installment plans: refund paid installments; cancel remaining.",
      evidence: "1 of 4 paid → refund the paid portion.",
    },
  ],
  conclusion: "→ Refund approved automatically · no human involved",
  context: [["Customer", "Morgan L."]],
  audit: "<b>who:</b> virtual agent",
};

describe("ResolvedDrawer", () => {
  it("renders recommendation lead, status, and conclusion", () => {
    render(<ResolvedDrawer analysis={analysis} />);
    expect(
      screen.getByText("✓ AUTO-RESOLVED — refund approved"),
    ).toBeInTheDocument();
    expect(screen.getByText("✓ fired")).toBeInTheDocument();
    expect(screen.getByText("✓ applied")).toBeInTheDocument();
    expect(
      screen.getByText("→ Refund approved automatically · no human involved"),
    ).toBeInTheDocument();
  });

  it("styles alert + timeline with Tailwind tokens (no colliding .rec/.tl classes)", () => {
    const { container } = render(<ResolvedDrawer analysis={analysis} />);

    expect(container.querySelector(".rec")).toBeNull();
    expect(container.querySelector(".tl")).toBeNull();

    const lead = screen.getByText("✓ AUTO-RESOLVED — refund approved");
    expect(lead.className).toMatch(/text-ok/);
    const alert = lead.parentElement;
    expect(alert?.className).toMatch(/border-ok\/32/);
    expect(alert?.className).toMatch(/bg-ok\/8/);

    const fired = screen.getByText("✓ fired");
    expect(fired.className).toMatch(/text-ok/);

    const concl = screen.getByText(
      "→ Refund approved automatically · no human involved",
    );
    expect(concl.className).toMatch(/text-ok/);
  });
});
