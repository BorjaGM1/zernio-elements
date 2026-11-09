// Screenshots of /compose with each example spec. Needs apps/web running:
//   pnpm --filter web exec next dev -p 3030
//   BASE=http://localhost:3030 pnpm --filter @zernio-elements/catalog screenshots
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.env.BASE ?? "http://localhost:3030";
const out = fileURLToPath(new URL("../screenshots/", import.meta.url));
await mkdir(out, { recursive: true });

const shots = [
  { name: "compose-weekly-report", q: "example=weekly-report" },
  { name: "compose-launch-checklist", q: "example=launch-checklist" },
  { name: "compose-account-health", q: "example=account-health" },
  { name: "compose-weekly-report-ferment", q: "example=weekly-report&theme=ferment" },
  { name: "compose-account-health-liftly", q: "example=account-health&theme=liftly" },
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
for (const s of shots) {
  await page.goto(`${base}/compose?${s.q}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); // dev-mode badge
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}${s.name}.png`, fullPage: true });
  console.log(`${s.name}.png`);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/compose?example=weekly-report`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (overflow > 0) console.warn(`mobile: ${overflow}px horizontal overflow`);
await page.screenshot({ path: `${out}compose-mobile.png`, fullPage: true });
console.log("compose-mobile.png");
await browser.close();
