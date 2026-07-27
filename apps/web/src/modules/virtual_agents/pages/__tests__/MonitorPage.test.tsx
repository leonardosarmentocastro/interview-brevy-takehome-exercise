import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonitorPage } from "@/modules/virtual_agents/pages/MonitorPage";

vi.mock("@/modules/virtual_agents/hooks/use-monitor", () => ({
  useMonitor: () => ({
    data: {
      stats: { resolved: 214, autoPct: 95, waiting: 11, humanReview: 2, escalated: 2 },
      log: [],
      intake: [],
      waiting: [
        {
          id: "iss_005",
          type: "Expired card",
          amountText: "$34.99",
          meta: "…",
          blocker: "✉ nudge sent",
        },
      ],
      waitingMore: 8,
      resolved: { count: 214, recent: [] },
      drill: { total: 214, chips: [], rows: [] },
      simPool: [],
      analysis: {},
    },
    isLoading: false,
  }),
}));

describe("MonitorPage", () => {
  it("renders the three pipeline columns and a drill link", () => {
    render(<MonitorPage autoRun={false} />);
    expect(screen.getByRole("heading", { name: /intake/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /waiting/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /resolved/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /drill/i })).toHaveAttribute(
      "href",
      "/monitors/agents/drill",
    );
  });

  it("keeps the live indicator and drops the duplicate page header", () => {
    render(<MonitorPage autoRun={false} />);
    expect(screen.getByText(/live · updates as tickets flow/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /virtual agent — pipeline monitor/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/machine · read-only/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Everything the automation is handling/i),
    ).not.toBeInTheDocument();
  });
});
