import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/boards/operators" }));
import { PipelineNav } from "@/shared/ui/components/PipelineNav";

describe("PipelineNav", () => {
  it("marks the step matching the current path as active", () => {
    render(<PipelineNav />);
    const operator = screen.getByRole("link", { name: /operator board/i });
    expect(operator).toHaveAttribute("aria-current", "page");
    const agent = screen.getByRole("link", { name: /virtual agent/i });
    expect(agent).not.toHaveAttribute("aria-current");
  });

  it("links each step to its route", () => {
    render(<PipelineNav />);
    expect(screen.getByRole("link", { name: /virtual agent/i })).toHaveAttribute("href", "/monitors/agents");
    expect(screen.getByRole("link", { name: /specialist board/i })).toHaveAttribute("href", "/boards/specialists");
  });
});
