import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import MonitorRoute from "@/app/monitors/agents/page";
import OperatorRoute from "@/app/boards/operators/page";
import SpecialistRoute from "@/app/boards/specialists/page";

vi.mock("@/modules/virtual_agents/hooks/use-monitor", () => ({
  useMonitor: () => ({ data: undefined, isLoading: true }),
}));
vi.mock("@/modules/operators/hooks/use-issues", () => ({
  useIssues: () => ({ data: undefined, isLoading: true }),
}));
vi.mock("@/modules/specialists/hooks/use-specialist", () => ({
  useSpecialist: () => ({ data: undefined, isLoading: true }),
}));

function wrap(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider>{ui}</JotaiProvider>
    </QueryClientProvider>,
  );
}

describe("route skeletons", () => {
  it("renders each board placeholder", () => {
    wrap(<MonitorRoute />);
    expect(screen.getByTestId("screen-monitor")).toBeInTheDocument();
    wrap(<OperatorRoute />);
    expect(screen.getByTestId("screen-operator")).toBeInTheDocument();
    wrap(<SpecialistRoute />);
    expect(screen.getByTestId("screen-specialist")).toBeInTheDocument();
  });
});
