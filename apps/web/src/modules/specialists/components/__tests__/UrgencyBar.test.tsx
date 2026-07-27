import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UrgencyBar } from "@/modules/specialists/components/UrgencyBar";

describe("UrgencyBar", () => {
  it("shows the SLA limit label and marks breach", () => {
    render(
      <UrgencyBar
        bar={{
          fillPct: 100,
          kind: "breach",
          word: "act-by",
          limit: "window spent — act now",
          elapsed: "",
        }}
        crit="crit"
      />,
    );
    expect(screen.getByText(/act now/i)).toBeInTheDocument();
  });
});
