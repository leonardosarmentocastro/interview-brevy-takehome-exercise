import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleModal } from "@/shared/ui/components/RoleModal";

describe("RoleModal", () => {
  it("enables only Admin and gates the other roles", () => {
    render(<RoleModal open onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.getAllByText(/requires auth/i)).toHaveLength(2);
  });

  it("calls onPick('admin') when Admin is chosen", async () => {
    const onPick = vi.fn();
    render(<RoleModal open onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onPick).toHaveBeenCalledWith("admin");
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RoleModal open={false} onPick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
