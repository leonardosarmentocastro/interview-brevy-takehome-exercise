import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../style.css"), "utf8");

describe("virtual_agents drill styles", () => {
  it("bolds .head h1, drops .sub max-width, greens rule/pattern plinks", () => {
    expect(css).toMatch(/\.head h1\s*\{[^}]*font-weight:\s*700/);
    expect(css).not.toMatch(/\.sub\s*\{[^}]*max-width:\s*720px/);
    expect(css).toMatch(
      /\.tbl td\.rule \.plink\s*\{[^}]*color:\s*var\(--color-ok\)/,
    );
    expect(css).toMatch(
      /\.pattern \.plink\s*\{[^}]*color:\s*var\(--color-ok\)/,
    );
  });
});
