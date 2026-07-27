import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAtomValue } from "jotai";
import { PolicyLink } from "@/shared/policies/components/PolicyLink";
import { policyLineAtom } from "@/shared/policies/data/atoms/policy-modal";

function Probe() { const v = useAtomValue(policyLineAtom); return <span data-testid="line">{String(v)}</span>; }

describe("PolicyLink", () => {
  it("sets the policy line atom on click", async () => {
    render(<><PolicyLink line={53} /><Probe /></>);
    await userEvent.click(screen.getByRole("button", { name: /policies\.md:53/ }));
    expect(screen.getByTestId("line")).toHaveTextContent("53");
  });
});
