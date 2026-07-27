import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleModal } from "@/shared/ui/components/RoleModal";

describe("RoleModal", () => {
  it("enables only Admin and gates the other roles", () => {
    render(<RoleModal open onPick={() => {}} />);
    expect(screen.getByText(/^Continue/)).toBeInTheDocument();
    expect(screen.getAllByText(/requires auth/i)).toHaveLength(2);
  });

  it("calls onPick('admin') when Admin is chosen", async () => {
    const onPick = vi.fn();
    render(<RoleModal open onPick={onPick} />);
    await userEvent.click(screen.getByText(/^Continue/));
    expect(onPick).toHaveBeenCalledWith("admin");
  });

  it("calls onPick('admin') when the Admin role row is clicked", async () => {
    const onPick = vi.fn();
    render(<RoleModal open onPick={onPick} />);
    await userEvent.click(
      screen.getByText(/Full visibility across all three pipeline layers/),
    );
    expect(onPick).toHaveBeenCalledWith("admin");
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RoleModal open={false} onPick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
