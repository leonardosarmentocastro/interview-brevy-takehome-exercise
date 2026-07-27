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
});
