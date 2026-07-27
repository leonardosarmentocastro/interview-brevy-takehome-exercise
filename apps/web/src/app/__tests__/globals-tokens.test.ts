import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "../globals.css"), "utf8");

describe("design tokens", () => {
  it("defines the ported palette inside @theme", () => {
    expect(css).toContain("@theme");
    for (const token of [
      "--color-bg: #0e1116",
      "--color-col: #161b22",
      "--color-col2: #1c2230",
      "--color-line: #2a3140",
      "--color-tx: #e6edf3",
      "--color-tx2: #9aa7b8",
      "--color-tx3: #8b97a8",
      "--color-ok: #3fb950",
      "--color-warn: #d29922",
      "--color-bad: #f85149",
      "--color-info: #58a6ff",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toMatch(/--font-mono:\s*ui-monospace/);
  });
});
