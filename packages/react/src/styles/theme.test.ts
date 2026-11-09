import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The shadcn registry ships theme.css as cssVars only, so any class rule here would silently
// be missing in apps that install components with `npx shadcn add`.
describe("theme.css", () => {
  it("only declares --ze-* variables", () => {
    const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1]!.trim());
    expect(selectors).toEqual([':root,\n[data-ze-theme="default"]']);
    const decls = [...css.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
    expect(decls.every((d) => d!.startsWith("--ze-"))).toBe(true);
  });
});
