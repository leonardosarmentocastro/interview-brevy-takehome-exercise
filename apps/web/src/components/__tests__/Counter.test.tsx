import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "@/components/Counter";

describe("Counter", () => {
  it("increments on click", async () => {
    render(<Counter />);
    const button = screen.getByRole("button", { name: /count: 0/ });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /count: 1/ })).toBeInTheDocument();
  });
});
