import { describe, expect, it } from "vitest";
import { formatMoney } from "@/modules/operators/utils/format-money";
describe("formatMoney", () => {
  it("formats with two decimals and a dollar sign", () => {
    expect(formatMoney(249)).toBe("$249.00");
    expect(formatMoney(34.9)).toBe("$34.90");
  });
});
