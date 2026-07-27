import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let path = "/monitors/agents";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
import { AppHeader } from "@/shared/ui/components/AppHeader";

describe("AppHeader", () => {
  it("shows the layer eyebrow and title for the current view", () => {
    path = "/boards/specialists";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(screen.getByText(/layer 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /specialist board/i })).toBeInTheDocument();
  });

  it("fires onSwitchRole when the identity chip is clicked", async () => {
    path = "/monitors/agents";
    const onSwitchRole = vi.fn();
    render(<AppHeader onSwitchRole={onSwitchRole} />);
    await userEvent.click(screen.getByRole("button", { name: /switch role/i }));
    expect(onSwitchRole).toHaveBeenCalledOnce();
  });

  it("shows the machine badge and interaction description on the monitor view", () => {
    path = "/monitors/agents";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(screen.getByText(/layer 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/machine · read-only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Everything the automation is handling with no human involved/i),
    ).toBeInTheDocument();
  });

  it("omits the machine badge and monitor description on other views", () => {
    path = "/boards/operators";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(screen.queryByText(/machine · read-only/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Everything the automation is handling/i),
    ).not.toBeInTheDocument();
  });

  it("shows the operator board description", () => {
    path = "/boards/operators";
    render(<AppHeader onSwitchRole={() => {}} />);
    expect(
      screen.getByText(
        /Human review queue for cases the virtual agent couldn’t close/i,
      ),
    ).toBeInTheDocument();
  });
});
