import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../style.css"), "utf8");

describe("appbar styles", () => {
  it("does not paint .appbar as a bordered card", () => {
    const block = css.match(/\.appbar\s*\{[^}]+\}/)?.[0] ?? "";
    expect(block).not.toMatch(/background:/);
    expect(block).not.toMatch(/border:/);
  });
});
