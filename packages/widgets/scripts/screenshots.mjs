/**
 * Screenshots every widget state at 380/720px, light/dark, through the dev host (real AppBridge
 * protocol). Also checks end to end that publish_post received exactly the preview's payload + hash.
 *
 *   node scripts/screenshots.mjs [filter]     (uses the system Chrome: channel "chrome")
 */
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../screenshots");
const filter = process.argv[2] ?? "";
execFileSync(process.execPath, [resolve(here, "build.mjs"), "--harness"], { stdio: "inherit" });
await mkdir(out, { recursive: true });
const port = 4318;
const server = await serve(port);

const f = (page) => page.frameLocator("#frame");
/** Wait until the host has applied the widget's reported height, then reset the frame's scroll. */
async function settle(page) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(120);
    const h = await page.evaluate(() => document.getElementById("frame").getBoundingClientRect().height);
    if (h === last) break;
    last = h;
  }
  for (const fr of page.frames()) if (fr !== page.mainFrame()) await fr.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(80);
}

/** name → { widget, scenario, act? } */
const SHOTS = {
  "preview-loading": { widget: "preview-post", scenario: "loading" },
  "preview-streaming": { widget: "preview-post", scenario: "streaming" },
  "preview": { widget: "preview-post" },
  "preview-x": { widget: "preview-post", act: async (p) => f(p).getByRole("tab", { name: /^X/ }).click() },
  "preview-published-x": {
    widget: "preview-post",
    act: async (p) => {
      await f(p).getByRole("button", { name: /^Publish 2$/ }).click();
      await f(p).getByText("Open post").first().waitFor();
      await f(p).getByRole("tab", { name: /^X/ }).click();
    },
  },
  "preview-instagram": { widget: "preview-post", act: async (p) => f(p).getByRole("tab", { name: /Instagram/ }).click() },
  "preview-bluesky": { widget: "preview-post", act: async (p) => f(p).getByRole("tab", { name: /Bluesky/ }).click() },
  "preview-tiktok": { widget: "preview-post", act: async (p) => f(p).getByRole("tab", { name: /TikTok/ }).click() },
  "preview-editing": {
    widget: "preview-post",
    act: async (p) => {
      await f(p).getByRole("tab", { name: /LinkedIn/ }).click();
      await f(p).getByRole("button", { name: /Edit LinkedIn/ }).click();
      await f(p).locator("textarea").fill("Our autumn menu starts Thursday: seven courses from producers within 80 km of the kitchen. 24 seats a night, reservations open now.");
    },
  },
  "preview-edit-pending": {
    widget: "preview-post",
    scenario: "edit-hang",
    act: async (p) => {
      await f(p).getByRole("tab", { name: /LinkedIn/ }).click();
      await f(p).getByRole("button", { name: /Edit LinkedIn/ }).click();
      await f(p).locator("textarea").fill("Our autumn menu starts Thursday. 24 seats a night, reservations open now.");
      await f(p).getByRole("button", { name: "Save" }).click();
    },
  },
  "preview-edited": {
    widget: "preview-post",
    act: async (p) => {
      await f(p).getByRole("tab", { name: /LinkedIn/ }).click();
      await f(p).getByRole("button", { name: /Edit LinkedIn/ }).click();
      await f(p).locator("textarea").fill("Our autumn menu starts Thursday. 24 seats a night, reservations open now.");
      await f(p).getByRole("button", { name: "Save" }).click();
      await f(p).getByRole("button", { name: /Edit LinkedIn/ }).waitFor();
    },
  },
  "preview-payload": { widget: "preview-post", act: async (p) => f(p).getByRole("button", { name: /What will be sent/ }).click() },
  "preview-publishing": { widget: "preview-post", scenario: "publish-hang", act: async (p) => f(p).getByRole("button", { name: /^Publish 2$/ }).click() },
  "preview-published": {
    widget: "preview-post",
    act: async (p) => {
      await f(p).getByRole("button", { name: /^Publish 2$/ }).click();
      await f(p).getByText("Open post").first().waitFor();
    },
  },
  "preview-publish-partial": {
    widget: "preview-post",
    scenario: "publish-partial",
    act: async (p) => {
      await f(p).getByRole("button", { name: /^Publish 2$/ }).click();
      await f(p).getByText("Partly published").waitFor();
    },
  },
  "preview-publish-error": {
    widget: "preview-post",
    scenario: "publish-error",
    act: async (p) => {
      await f(p).getByRole("button", { name: /^Publish 2$/ }).click();
      await f(p).getByRole("button", { name: "Try again" }).waitFor();
    },
  },
  "preview-nothing": { widget: "preview-post", scenario: "nothing" },
  "preview-error": { widget: "preview-post", scenario: "error" },
  "analytics-loading": { widget: "analytics", scenario: "loading" },
  "analytics": { widget: "analytics" },
  "analytics-engagement": { widget: "analytics", act: async (p) => f(p).getByRole("radio", { name: "Engagement" }).click() },
  "analytics-sample": { widget: "analytics", scenario: "sample" },
  "analytics-unavailable": { widget: "analytics", scenario: "unavailable" },
  "analytics-error": { widget: "analytics", scenario: "error" },
  "view-weekly-report": { widget: "render-view", example: "weekly-report" },
  "view-launch-checklist": { widget: "render-view", example: "launch-checklist" },
  "view-account-health": { widget: "render-view", example: "account-health" },
  "view-error": { widget: "render-view", scenario: "error" },
  "accounts-loading":{ widget: "accounts", scenario: "loading" },
  "accounts": { widget: "accounts" },
};

const browser = await chromium.launch({ channel: "chrome" });
let failures = 0;
try {
  for (const [name, s] of Object.entries(SHOTS)) {
    if (filter && !name.includes(filter)) continue;
    for (const width of [380, 720]) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width: width + 48, height: 1800 }, deviceScaleFactor: 2, colorScheme: theme });
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        const url = `http://127.0.0.1:${port}/host.html?widget=${s.widget}&theme=${theme}&width=${width}&scenario=${s.scenario ?? "result"}${s.example ? `&example=${s.example}` : ""}`;
        await page.goto(url);
        await page.waitForFunction(() => window.__ready === true);
        await f(page).locator("#root > *").first().waitFor();
        if (s.widget === "preview-post" && !s.scenario?.match(/loading|streaming|error$|cancelled/)) await f(page).getByRole("tablist").waitFor();
        await settle(page);
        if (s.act) await s.act(page);
        await page.mouse.move(0, 0);
        await settle(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        const box = await page.locator("#wrap").boundingBox();
        await page.screenshot({ path: resolve(out, `${name}-${width}-${theme}.png`), clip: { x: 0, y: 0, width: width + 48, height: Math.ceil(box.y + box.height + 24) } });

        if (name === "preview-published") {
          const { calls, preview } = await page.evaluate(() => ({ calls: window.__calls, preview: window.__lastPreview }));
          const pub = calls.find((c) => c.name === "publish_post");
          const ok = pub && isDeepStrictEqual(pub.arguments, { payload: preview.payload, payloadHash: preview.payloadHash });
          if (!ok) failures++;
          console.log(`${ok ? "ok  " : "FAIL"} e2e: publish_post args === preview payload + hash (${width} ${theme})`);
        }
        if (name === "preview-edited") {
          const calls = await page.evaluate(() => window.__calls);
          const edit = calls.find((c) => c.name === "preview_post");
          const ok = edit?.arguments?.overrides?.linkedin?.content?.startsWith("Our autumn menu starts Thursday. 24 seats");
          if (!ok) failures++;
          console.log(`${ok ? "ok  " : "FAIL"} e2e: edit called preview_post with the LinkedIn override (${width} ${theme})`);
        }
        if (errors.length) {
          failures++;
          console.log(`FAIL ${name}-${width}-${theme}: ${errors.join(" | ")}`);
        }
        await page.close();
      }
    }
    console.log(`shot ${name}`);
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
