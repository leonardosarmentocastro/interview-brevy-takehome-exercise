import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/db/data/pg-errors";

describe("isUniqueViolation", () => {
  it("detects the code on the error itself", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects the code on a wrapped cause (drizzle wraps the pg error)", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("detects the code deeper down the cause chain", () => {
    expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(true);
  });

  it("returns false for a different Postgres error code", () => {
    expect(isUniqueViolation({ cause: { code: "23503" } })).toBe(false);
  });

  it("returns false for non-object / empty errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
