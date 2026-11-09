import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const pkg = resolve(import.meta.dirname, "..");
const FILES = ["preview-post.html", "analytics.html", "accounts.html", "render-view.html"];

beforeAll(() => {
  // turbo runs test without build; build once if dist is missing.
  if (!FILES.every((f) => existsSync(resolve(pkg, "dist", f))) || !existsSync(resolve(pkg, "dist/index.js"))) {
    execFileSync(process.execPath, [resolve(pkg, "scripts/build.mjs")], { cwd: pkg, stdio: "inherit" });
  }
}, 180_000);

describe("built widgets", () => {
  it.each(FILES)("%s is a single self-contained file", (file) => {
    const html = readFileSync(resolve(pkg, "dist", file), "utf8");
    expect(html).toMatch(/^<!doctype html>/i);
    // Check the document's own tags, not strings inside the inlined JS (react-dom builds "<link href=" text).
    const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>").replace(/(<style\b[^>]*>)[\s\S]*?<\/style>/gi, "$1</style>");
    expect(markup).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(markup).not.toMatch(/<link[^>]*\shref=/i);
    expect(html).not.toMatch(/@import\s+url\(\s*["']?https?:/i);
    expect(html).toMatch(/<script type="module"[^>]*>/);
    expect(html).toMatch(/<style[^>]*>/);
  });

  it("dist/index.js exports the three HTML strings", async () => {
    const mod = (await import(resolve(pkg, "dist/index.js"))) as Record<string, string>;
    expect(Object.keys(mod).sort()).toEqual(["accountsHtml", "analyticsHtml", "previewPostHtml", "renderViewHtml"]);
    expect(mod.previewPostHtml).toBe(readFileSync(resolve(pkg, "dist/preview-post.html"), "utf8"));
    expect(readFileSync(resolve(pkg, "dist/index.d.ts"), "utf8")).toContain("export declare const previewPostHtml: string;");
  });
});
