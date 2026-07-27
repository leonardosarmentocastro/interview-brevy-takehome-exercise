import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MonitorRoute from "@/app/monitors/agents/page";
import OperatorRoute from "@/app/boards/operators/page";
import SpecialistRoute from "@/app/boards/specialists/page";

describe("route skeletons", () => {
  it("renders each board placeholder", () => {
    render(<MonitorRoute />);
    expect(screen.getByTestId("screen-monitor")).toBeInTheDocument();
    render(<OperatorRoute />);
    expect(screen.getByTestId("screen-operator")).toBeInTheDocument();
    render(<SpecialistRoute />);
    expect(screen.getByTestId("screen-specialist")).toBeInTheDocument();
  });
});
