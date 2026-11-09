import { describe, expect, it } from "vitest";
import { adapt, applyFix, countText, splitThread, toCreatePostBody, truncateAt, validate, validationBody, PLATFORM_IDS, SPECS } from "./index";
import type { ComposerPost } from "./index";

const post = (content: string, extra: Partial<ComposerPost> = {}): ComposerPost => ({
  content,
  media: [],
  ...extra,
});

describe("countText", () => {
  it("counts graphemes, not UTF-16 units", () => {
    expect(countText("héllo 👋🏽", "graphemes")).toBe(7);
  });
  it("counts URLs as 23 on X", () => {
    expect(countText("see https://example.com/a/very/long/path/that/goes/on", "twitter")).toBe(4 + 23);
  });
  it("weighs CJK as 2 on X", () => {
    expect(countText("日本", "twitter")).toBe(4);
  });
  it("counts like Zernio (UTF-16 length) on chars platforms", () => {
    expect(countText("👋🏽 hi", "chars")).toBe(7);
  });
  it("takes the stricter of X's weighting and Zernio's count on X", () => {
    // X weighs a family emoji as 2; Zernio counts its 8 UTF-16 units.
    expect(countText("👨‍👩‍👧", "twitter")).toBe(8);
    // CJK: X counts 2 each, Zernio 1.
    expect(countText("日本", "twitter")).toBe(4);
  });
});

describe("splitThread", () => {
  it("keeps short text as one segment", () => {
    expect(splitThread("hello", 280, "twitter")).toEqual(["hello"]);
  });
  it("splits long text into numbered segments that each fit", () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const parts = splitThread(long, 280, "twitter");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(countText(p, "twitter")).toBeLessThanOrEqual(280);
    expect(parts[0]).toMatch(/ 1\/\d+$/);
  });
});

describe("splitThread keeps the text intact", () => {
  it("never breaks URLs, decimals or abbreviations", () => {
    const text =
      "Our autumn tasting menu starts Thursday with seven courses from producers within 80 km of the kitchen. Book at https://hostly.example/menu now. Prices from 12.50 per person, e.g. the full pairing is extra. Only 24 seats a night, two sittings, so book early. Reservations are open now and fill up fast every year.";
    const parts = splitThread(text, 300, "chars");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((p) => p.replace(/ \d+\/\d+$/, "")).join(" ")).toBe(text.replace(/\s+/g, " "));
    expect(parts.join(" ")).toContain("https://hostly.example/menu");
    expect(parts.join(" ")).toContain("12.50");
  });
});

describe("unsplittable thread segments", () => {
  it("errors when one token is longer than the limit (the post would be rejected)", () => {
    const r = validate(post(`Look: https://example.com/${"a".repeat(320)} and more text after it.`), ["bluesky"]);
    expect(r.valid).toBe(false);
    expect(r.byPlatform.bluesky?.map((i) => i.code)).toContain("text_too_long");
  });
});

describe("splitThread balance", () => {
  it("splits into balanced posts at sentence boundaries instead of a full post and a stub", () => {
    const text =
      "Our autumn tasting menu starts Thursday. Seven courses, every producer within 80 km of the kitchen: wild mushrooms from the hills, line-caught hake, and the last txakoli before the harvest closes. Each course is paired with natural wines from our cellar. Only 24 seats a night, two sittings. Reservations are open now.";
    const parts = splitThread(text, 300, "chars");
    expect(parts).toHaveLength(2);
    const [a, b] = parts.map((p) => p.replace(/ \d+\/\d+$/, "").length);
    expect(Math.abs(a! - b!)).toBeLessThan(Math.max(a!, b!) * 0.6);
    expect(parts[1]).not.toBe("Reservations are open now. 2/2");
    for (const p of parts) expect(p).toMatch(/[.!?] \d+\/2$/);
  });
  it("never uses more posts than the greedy split", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is a bit longer than before.`).join(" ");
    const parts = splitThread(long, 280, "twitter");
    for (const p of parts) expect(countText(p, "twitter")).toBeLessThanOrEqual(280);
    expect(parts.length).toBeLessThanOrEqual(Math.ceil(countText(long, "twitter") / 274) + 1);
  });
});

describe("truncateAt", () => {
  it("cuts at a word boundary", () => {
    const r = truncateAt("The quick brown fox jumps over the lazy dog", 20);
    expect(r.truncated).toBe(true);
    expect(r.visible).toBe("The quick brown fox");
  });
});

describe("validate", () => {
  it("requires media on Instagram and TikTok", () => {
    const r = validate(post("hi"), ["instagram", "tiktok", "linkedin"]);
    expect(r.valid).toBe(false);
    expect(r.byPlatform.instagram?.map((i) => i.code)).toContain("media_required");
    expect(r.byPlatform.linkedin).toEqual([]);
  });

  it("threads instead of erroring on X", () => {
    const r = validate(post("a ".repeat(400)), ["twitter"]);
    expect(r.byPlatform.twitter?.[0]?.code).toBe("text_will_be_threaded");
    expect(r.valid).toBe(true);
  });

  it("errors on non-threading platforms over the limit", () => {
    const r = validate(post("a".repeat(1600)), ["googlebusiness"]);
    expect(r.byPlatform.googlebusiness?.[0]?.code).toBe("text_too_long");
  });

  it("flags a missing YouTube/Reddit title as a warning (Zernio falls back to the first line)", () => {
    const video = { url: "https://x/v.mp4", type: "video" as const, durationSec: 30 };
    const r = validate(post("desc", { media: [video] }), ["youtube", "reddit"]);
    expect(r.byPlatform.youtube?.find((i) => i.code === "title_missing")?.severity).toBe("warning");
    expect(r.byPlatform.reddit?.map((i) => i.code)).toContain("title_missing");
    expect(r.valid).toBe(true);
    expect(validate(post("desc", { title: "Tour", media: [video] }), ["youtube"]).issues).toEqual([]);
  });

  it("matches Zernio's media rules: no mixing on Facebook/Threads, 20-item Instagram carousels", () => {
    const img = (n: number) => ({ url: `https://x/${n}.jpg`, type: "image" as const });
    const vid = { url: "https://x/v.mp4", type: "video" as const, durationSec: 10 };
    const mixed = post("hi", { media: [img(1), vid] });
    expect(validate(mixed, ["facebook"]).byPlatform.facebook?.map((i) => i.code)).toContain("mixed_media_not_allowed");
    expect(validate(mixed, ["threads"]).byPlatform.threads?.map((i) => i.code)).toContain("mixed_media_not_allowed");
    expect(validate(mixed, ["instagram"]).valid).toBe(true);
    const many = post("hi", { media: Array.from({ length: 20 }, (_, i) => img(i)) });
    expect(validate(many, ["instagram"]).valid).toBe(true);
    expect(validate(many, ["threads"]).byPlatform.threads?.map((i) => i.code)).toContain("too_many_media");
  });

  it("rejects an image-only post on YouTube", () => {
    const r = validate(post("hi", { title: "t", media: [{ url: "https://x/a.jpg", type: "image" }] }), ["youtube"]);
    expect(r.byPlatform.youtube?.find((i) => i.code === "media_required")?.message).toBe("YouTube needs a video.");
  });

  it("caps Bluesky video at 60s", () => {
    const vid = (d: number) => post("hi", { media: [{ url: "https://x/v.mp4", type: "video" as const, durationSec: d }] });
    expect(validate(vid(59), ["bluesky"]).valid).toBe(true);
    expect(validate(vid(61), ["bluesky"]).byPlatform.bluesky?.map((i) => i.code)).toContain("video_too_long");
  });

  it("uses the Telegram caption limit when media is attached", () => {
    const img = { url: "https://x/a.jpg", type: "image" as const };
    expect(validate(post("a".repeat(2000)), ["telegram"]).valid).toBe(true);
    expect(validate(post("a".repeat(2000), { media: [img] }), ["telegram"]).valid).toBe(false);
  });

  it("respects per-platform overrides", () => {
    const r = validate(post("a".repeat(1600), { overrides: { googlebusiness: { content: "short" } } }), ["googlebusiness"]);
    expect(r.valid).toBe(true);
  });
});

describe("adapt + toCreatePostBody", () => {
  it("builds threadItems for long X posts", () => {
    const p = post("Word ".repeat(200));
    expect(adapt(p, "twitter").segments.length).toBeGreaterThan(1);
    const body = toCreatePostBody(p, [{ platform: "twitter", accountId: "acc_1" }], { publishNow: true });
    const items = body.platforms[0]?.platformSpecificData?.threadItems as unknown[];
    expect(items.length).toBeGreaterThan(1);
    expect(body.publishNow).toBe(true);
  });

  it("sends alt text as Zernio's altText field, including on the thread root", () => {
    const img = { url: "https://x/a.jpg", type: "image" as const, alt: "Terrace at sunset" };
    const body = toCreatePostBody(post("Word ".repeat(200), { media: [img] }), [{ platform: "twitter", accountId: "a" }]);
    expect(body.mediaItems).toEqual([{ url: img.url, type: "image", altText: "Terrace at sunset" }]);
    const items = body.platforms[0]?.platformSpecificData?.threadItems as Array<{ mediaItems?: unknown[] }>;
    expect(items[0]?.mediaItems).toEqual(body.mediaItems);
    expect(JSON.stringify(body)).not.toContain('"alt"');
  });

  it("never sends customContent on a thread (Zernio would publish one post and drop threadItems)", () => {
    const p = post("Sentence here. ".repeat(30));
    const body = toCreatePostBody(p, [{ platform: "bluesky", accountId: "b" }]);
    expect(body.platforms[0]!.customContent).toBeUndefined();
    expect((body.platforms[0]!.platformSpecificData?.threadItems as unknown[]).length).toBeGreaterThan(1);
  });

  it("validates thread targets with the root segment, without touching the published body", () => {
    const p = post("Sentence here. ".repeat(30));
    const body = toCreatePostBody(p, [{ platform: "bluesky", accountId: "b" }, { platform: "linkedin", accountId: "l" }]);
    const before = JSON.stringify(body);
    const v = validationBody(body);
    const items = body.platforms[0]!.platformSpecificData?.threadItems as Array<{ content: string }>;
    expect(v.platforms[0]!.customContent).toBe(items[0]!.content);
    expect(countText(v.platforms[0]!.customContent!, "chars")).toBeLessThanOrEqual(300);
    expect(v.platforms[1]!.customContent).toBeUndefined();
    expect(JSON.stringify(body)).toBe(before);
  });

  it("puts customContent only when an override differs", () => {
    const p = post("base", { overrides: { linkedin: { content: "for linkedin" } } });
    const body = toCreatePostBody(p, [
      { platform: "linkedin", accountId: "a" },
      { platform: "bluesky", accountId: "b" },
    ]);
    expect(body.platforms[0]?.customContent).toBe("for linkedin");
    expect(body.platforms[1]?.customContent).toBeUndefined();
  });
});

describe("specs", () => {
  it("has a spec for every publishing platform", () => {
    for (const id of PLATFORM_IDS) expect(SPECS[id].id).toBe(id);
  });
});

describe("applyFix", () => {
  const issueFor = (p: ComposerPost, platform: Parameters<typeof validate>[1][number], code: string) =>
    validate(p, [platform]).issues.find((i) => i.code === code)!;

  it("truncates only the failing platform, and the result validates", () => {
    const p = post("Long sentence here. ".repeat(100));
    const fixed = applyFix(p, issueFor(p, "googlebusiness", "text_too_long"));
    expect(fixed.content).toBe(p.content);
    expect(fixed.overrides?.googlebusiness?.content?.endsWith("…")).toBe(true);
    expect(validate(fixed, ["googlebusiness"]).valid).toBe(true);
  });

  it("adds a title from the first line, without hashtags", () => {
    const video = { url: "https://x/v.mp4", type: "video" as const, durationSec: 30 };
    const p = post("Casa Azul tour #cartagena\nMore below", { media: [video] });
    const fixed = applyFix(p, issueFor(p, "youtube", "title_missing"));
    expect(fixed.title).toBe("Casa Azul tour");
    expect(validate(fixed, ["youtube"]).byPlatform.youtube?.some((i) => i.code === "title_missing")).toBe(false);
  });

  it("keeps the allowed number of hashtags", () => {
    const p = post("Open house Saturday #one #two #three");
    const fixed = applyFix(p, issueFor(p, "threads", "too_many_hashtags"));
    expect(fixed.overrides?.threads?.content).toBe("Open house Saturday #one");
  });
});
