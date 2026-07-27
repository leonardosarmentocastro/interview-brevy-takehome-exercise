import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "@/modules/operators/components/Timeline";

const trace = [
  {
    src: 53,
    status: "fired" as const,
    rule: "Escalate if amount > $200.",
    evidence: "$249 → triggers escalation.",
  },
  {
    src: 51,
    status: "not_met" as const,
    rule: "Auto-resolve if delivered + 3 days.",
    evidence: "In transit.",
  },
];

describe("Timeline", () => {
  it("renders each trace row with its rule and a policy link", () => {
    render(<Timeline trace={trace} />);
    expect(screen.getByText(/amount > \$200/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /policies\.md:53/ }),
    ).toBeInTheDocument();
  });
});
