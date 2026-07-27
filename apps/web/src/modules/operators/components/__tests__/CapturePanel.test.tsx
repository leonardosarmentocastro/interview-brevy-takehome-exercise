import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider, useSetAtom, useAtomValue } from "jotai";
import { CapturePanel } from "@/modules/operators/components/CapturePanel";
import { DecisionDialog } from "@/modules/operators/components/DecisionDialog";
import {
  openCaptureAtom,
  captureLogAtom,
} from "@/modules/operators/data/atoms/capture";

function Harness() {
  const open = useSetAtom(openCaptureAtom);
  const log = useAtomValue(captureLogAtom);
  return (
    <>
      <button onClick={() => open({ label: "Escalate to specialist", danger: true })}>
        open
      </button>
      <span data-testid="n">{log.length}</span>
      <CapturePanel />
      <DecisionDialog />
    </>
  );
}

describe("CapturePanel", () => {
  it("requires a second confirmation before writing to the audit log", async () => {
    render(
      <Provider store={createStore()}>
        <Harness />
      </Provider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByText(/confirm & log/i)).toBeInTheDocument();

    // First confirm only opens the confirmation dialog — nothing logged yet.
    await userEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("n")).toHaveTextContent("0");

    // Confirming in the dialog commits it.
    await userEvent.click(
      screen.getByRole("button", { name: /Confirm decision/ }),
    );
    expect(screen.getByTestId("n")).toHaveTextContent("1");
  });
});
