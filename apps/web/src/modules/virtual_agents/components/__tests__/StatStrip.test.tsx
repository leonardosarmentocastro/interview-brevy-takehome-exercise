import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatStrip } from "@/modules/virtual_agents/components/StatStrip";

describe("StatStrip", () => {
  it("shows the headline pipeline stats", () => {
    render(
      <StatStrip
        stats={{
          resolved: 214,
          autoPct: 95,
          waiting: 11,
          humanReview: 2,
          escalated: 2,
        }}
      />,
    );
    expect(screen.getByText("214")).toBeInTheDocument();
    expect(screen.getByText(/95/)).toBeInTheDocument();
  });
});
