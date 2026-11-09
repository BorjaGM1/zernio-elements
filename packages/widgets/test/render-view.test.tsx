import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EXAMPLES } from "@zernio-elements/catalog";
import { RenderView, RenderViewError } from "../src/render-view/RenderView";
import { renderViewErrorFixture } from "../src/harness/fixtures";
import { parseRenderView } from "../src/types";

const FOOTER = "Built from Zernio Elements components · validated against the catalog";

describe("render-view (static)", () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))("renders the %s example with the catalog", (_id, example) => {
    const data = parseRenderView({ title: example.label, spec: example.spec })!;
    const html = renderToStaticMarkup(<RenderView data={data} />);
    expect(html).toContain(example.label);
    expect(html).toContain(FOOTER);
    expect(html).not.toContain("doesn&#x27;t match the catalog");
  });

  it("shows render_view refusals calmly, with the error list", () => {
    const html = renderToStaticMarkup(<RenderViewError {...renderViewErrorFixture} />);
    expect(html).toContain("This view couldn&#x27;t be rendered");
    for (const e of renderViewErrorFixture.errors) expect(html).toContain(e.replace(/"/g, "&quot;"));
  });

  it("rejects results without a spec", () => {
    expect(parseRenderView({ title: "x" })).toBeNull();
  });
});

/*
 * Through the dev host: the real AppBridge sends each example as the tool result over postMessage.
 * Uses the system Chrome (Playwright channel "chrome"); skipped when it isn't installed.
 */
type Browser = import("playwright").Browser;
const pkg = resolve(import.meta.dirname, "..");
let browser: Browser | null = null;
let server: { close(): void } | null = null;
const port = 4319;

beforeAll(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ channel: "chrome" });
  } catch {
    browser = null;
    return;
  }
  execFileSync(process.execPath, [resolve(pkg, "scripts/build.mjs"), "--harness-only"], { cwd: pkg, stdio: "ignore" });
  // @ts-expect-error plain .mjs helper without types
  const { serve } = await import("../scripts/serve.mjs");
  server = await serve(port);
}, 240_000);

afterAll(async () => {
  server?.close();
  // System Chrome sometimes takes >10s to quit; don't let teardown fail a passing suite.
  await Promise.race([browser?.close(), new Promise((r) => setTimeout(r, 8000))]);
}, 30_000);

async function open(query: string) {
  const page = await browser!.newPage({ viewport: { width: 768, height: 1600 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/host.html?widget=render-view&width=720&${query}`);
  await page.waitForFunction(() => (window as unknown as { __ready: boolean }).__ready === true);
  return { page, frame: page.frameLocator("#frame"), errors };
}

describe("render-view (through the dev-host bridge)", () => {
  it.each(EXAMPLES.map((e) => e.id))("renders %s", async (id) => {
    if (!browser) return;
    const example = EXAMPLES.find((e) => e.id === id)!;
    const { page, frame, errors } = await open(`example=${id}`);
    await frame.getByText(FOOTER).waitFor({ timeout: 10_000 });
    await expect(frame.getByRole("heading", { name: example.label, exact: true }).count()).resolves.toBeGreaterThan(0);
    await expect(frame.getByText("doesn't match the catalog").count()).resolves.toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  }, 30_000);

  it("renders the error state", async () => {
    if (!browser) return;
    const { page, frame } = await open("scenario=error");
    await frame.getByText("This view couldn't be rendered").waitFor({ timeout: 10_000 });
    for (const e of renderViewErrorFixture.errors) await expect(frame.getByText(e).count()).resolves.toBe(1);
    await page.close();
  }, 30_000);
});
