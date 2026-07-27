import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSetAtom } from "jotai";
import { PolicyModal } from "@/shared/policies/components/PolicyModal";
import { policyLineAtom } from "@/shared/policies/data/atoms/policy-modal";

vi.mock("@/shared/policies/hooks/use-policies", () => ({
  usePolicies: () => ({ data: { lines: Array.from({ length: 60 }, (_, i) => `line ${i + 1}`) } }),
}));

function Open({ line }: { line: number }) {
  const set = useSetAtom(policyLineAtom);
  return <button onClick={() => set(line)}>open</button>;
}

describe("PolicyModal", () => {
  it("is hidden until a line is selected, then shows a window around it", async () => {
    render(<><PolicyModal /><Open line={10} /></>);
    expect(screen.queryByText("line 10")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText("line 10")).toBeInTheDocument();
    expect(screen.getByText("line 6")).toBeInTheDocument();
    expect(screen.getByText("line 14")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    render(<><PolicyModal /><Open line={10} /></>);
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    await userEvent.click(screen.getByTestId("policy-backdrop"));
    expect(screen.queryByText("line 10")).not.toBeInTheDocument();
  });
});
