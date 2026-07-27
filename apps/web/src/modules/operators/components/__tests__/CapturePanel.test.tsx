import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSetAtom, useAtomValue } from "jotai";
import { CapturePanel } from "@/modules/operators/components/CapturePanel";
import {
  openCaptureAtom,
  captureLogAtom,
} from "@/modules/operators/data/atoms/capture";

function Harness() {
  const open = useSetAtom(openCaptureAtom);
  const log = useAtomValue(captureLogAtom);
  return (
    <>
      <button onClick={() => open("Escalate to specialist")}>open</button>
      <span data-testid="n">{log.length}</span>
      <CapturePanel />
    </>
  );
}

describe("CapturePanel", () => {
  it("confirms an action into the audit log", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText(/confirm & log/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(screen.getByTestId("n")).toHaveTextContent("1");
  });
});
