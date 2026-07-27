import { describe, expect, it } from "vitest";
import { daysBetween } from "@/modules/operators/utils/days-between";
describe("daysBetween", () => {
  it("floors the day difference", () => {
    expect(daysBetween("2025-01-13T12:00:00Z", "2025-01-10T00:00:00Z")).toBe(3);
  });
  it("never returns negative", () => {
    expect(daysBetween("2025-01-01T00:00:00Z", "2025-01-10T00:00:00Z")).toBe(0);
  });
});
