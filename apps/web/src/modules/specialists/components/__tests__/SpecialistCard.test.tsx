import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialistCard } from "@/modules/specialists/components/SpecialistCard";

const card = {
  id: "iss_003",
  type: "Dispute · not received",
  amountText: "$249.00",
  meta: "iss_003 · M. Patel · FashionForward · 3h",
  crit: "high",
  tier: "High",
  cat: "dispute",
  bar: {
    fillPct: 55,
    kind: "reval",
    word: "re-evaluate",
    limit: "carrier ETA Jan 14",
    elapsed: "in queue 3h",
  },
  prov: { mode: "manual", reason: "over $200", ref: 53 },
} as never;

describe("SpecialistCard", () => {
  it("shows tier, amount, and manual-escalation provenance with policy ref", () => {
    render(<SpecialistCard card={card} />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("$249.00")).toBeInTheDocument();
    expect(screen.getByText(/manually/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /policies\.md:53/ }),
    ).toBeInTheDocument();
  });
});
