import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaseHistory } from "@/modules/specialists/components/CaseHistory";

const nodes = [
  {
    actor: "virtual agent",
    t: "Jan 13 08:15",
    val: "Evaluated → recommend escalate (:53)",
  },
  { actor: "you", t: "Jan 13 11:02", val: "Picked up → investigating" },
] as never;

describe("CaseHistory", () => {
  it("renders actor-tagged history entries", () => {
    render(<CaseHistory nodes={nodes} />);
    expect(screen.getByText(/virtual agent/i)).toBeInTheDocument();
    expect(screen.getByText(/Picked up/)).toBeInTheDocument();
  });
});
