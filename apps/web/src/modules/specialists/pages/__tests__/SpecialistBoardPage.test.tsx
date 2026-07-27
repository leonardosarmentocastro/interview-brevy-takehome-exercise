import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecialistBoardPage } from "@/modules/specialists/pages/SpecialistBoardPage";

vi.mock("@/modules/specialists/hooks/use-specialist", () => ({
  useSpecialist: () => ({
    data: {
      online: 3,
      breakdown: "2 Critical · 2 High · 1 Moderate",
      queue: [
        {
          id: "iss_087",
          type: "Unauthorized charge",
          amountText: "$780.00",
          meta: "iss_087 · …",
          crit: "crit",
          tier: "Critical",
          cat: "fraud",
          bar: {
            fillPct: 100,
            kind: "breach",
            word: "act-by",
            limit: "act now",
            elapsed: "",
          },
          prov: { mode: "auto", reason: "fraud always", ref: 63 },
        },
      ],
      mine: { investigating: [], onhold: [] },
    },
  }),
}));

describe("SpecialistBoardPage", () => {
  it("renders the TEAM and MINE zones with queue cards", () => {
    render(<SpecialistBoardPage />);
    expect(screen.getByText(/team/i)).toBeInTheDocument();
    expect(screen.getByText(/investigating/i)).toBeInTheDocument();
    expect(screen.getByText("$780.00")).toBeInTheDocument();
  });
});
