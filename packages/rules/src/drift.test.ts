/**
 * Drift test: our text rules vs Zernio's live POST /v1/tools/validate/post-length.
 * Skipped without ZERNIO_API_KEY (read from the env or apps/web/.env.local).
 *
 *   ZERNIO_API_KEY=sk_... pnpm --filter @zernio-elements/rules test
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countText, PLATFORM_IDS, SPECS, type PlatformId } from "./index";

function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const file = fileURLToPath(new URL("../../../apps/web/.env.local", import.meta.url));
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim() || undefined;
}

const KEY = env("ZERNIO_API_KEY");
const BASE = (env("ZERNIO_BASE_URL") ?? "https://zernio.com/api").replace(/\/$/, "");

type LengthResponse = { platforms?: Record<string, { count?: number; limit?: number; valid?: boolean }> };

async function postLength(text: string): Promise<LengthResponse> {
  const res = await fetch(`${BASE}/v1/tools/validate/post-length`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
  return (await res.json()) as LengthResponse;
}

const SAMPLES = [
  "Plain ASCII text for a quick check.",
  "Emoji 👋🏽 and accents: héllo, café, niño.",
  "A link https://example.com/a/very/long/path?with=query&and=more counts as 23 on X.",
  "日本語のテキスト and mixed CJK 中文",
  "Line one\n\nLine two #hashtag @mention",
  "👨‍👩‍👧 family emoji, a ZWJ sequence",
];

describe.skipIf(!KEY)("drift vs Zernio /v1/tools/validate/post-length", () => {
  it("returns a limit for every platform we know, equal to our spec", async () => {
    const r = await postLength(SAMPLES[0]!);
    const platforms = r.platforms ?? {};
    const ours = PLATFORM_IDS.filter((id) => id in platforms);
    expect(ours.length, `keys returned: ${Object.keys(platforms).join(", ")}`).toBeGreaterThan(0);
    const mismatches = ours
      .filter((id) => platforms[id]?.limit !== SPECS[id].text.maxLength)
      .map((id) => `${id}: ours ${SPECS[id].text.maxLength}, Zernio ${platforms[id]?.limit}`);
    expect(mismatches).toEqual([]);
  });

  it.each(SAMPLES)("counts like Zernio: %s", async (text) => {
    const r = await postLength(text);
    const platforms = r.platforms ?? {};
    const mismatches = (Object.keys(platforms) as PlatformId[])
      .filter((id) => id in SPECS)
      .filter((id) => {
        const ours = countText(text, SPECS[id].text.countMode);
        const theirs = platforms[id]?.count ?? -1;
        // On X we also apply X's own weighting (CJK = 2), so we may count more than Zernio, never less.
        return id === "twitter" ? ours < theirs : ours !== theirs;
      })
      .map((id) => `${id}: ours ${countText(text, SPECS[id].text.countMode)}, Zernio ${platforms[id]?.count}`);
    expect(mismatches).toEqual([]);
  });

  it("reports X Premium at 25000", async () => {
    const r = await postLength("hi");
    const premium = r.platforms?.twitterPremium ?? r.platforms?.twitter_premium;
    if (premium) expect(premium.limit).toBe(25000);
  });
});
