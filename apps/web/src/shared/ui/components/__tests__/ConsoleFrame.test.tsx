import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import { roleAtom } from "@/shared/ui/data/atoms/role";

let path = "/monitors/agents";
vi.mock("next/navigation", () => ({
  usePathname: () => path,
  useRouter: () => ({ push: vi.fn() }),
}));

import { ConsoleFrame } from "@/shared/ui/components/ConsoleFrame";

function wrap(pathValue: string) {
  path = pathValue;
  const store = createStore();
  store.set(roleAtom, "admin");
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <ConsoleFrame>
          <div data-testid="child">child</div>
        </ConsoleFrame>
      </JotaiProvider>
    </QueryClientProvider>,
  );
}

describe("ConsoleFrame", () => {
  it("shows the virtual-agent appbar on the monitor route", () => {
    wrap("/monitors/agents");
    expect(
      screen.getByRole("heading", {
        name: /Virtual agent — pipeline monitor/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("hides the appbar on the auto-resolved drill route", () => {
    wrap("/monitors/agents/drill");
    expect(
      screen.queryByRole("heading", {
        name: /Virtual agent — pipeline monitor/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /switch role/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
