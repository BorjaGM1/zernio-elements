import { describe, expect, it } from "vitest";
import { buildPreview, canonicalJson, hashPayload, verifyPayload, type AccountRef } from "./mcp";

const accounts: AccountRef[] = [
  { platform: "bluesky", accountId: "acc_bs", username: "demo.bsky.social" },
  { platform: "linkedin", accountId: "acc_li" },
  { platform: "tiktok", accountId: "acc_tt" },
];

const long =
  "The autumn tasting menu starts Thursday. Seven courses, all from producers within 80 km of the kitchen, paired with natural wines from our cellar.\n\nExpect wild mushrooms, line-caught hake, and the last txakoli before the harvest closes. Only 24 seats a night. Reservations open now.";

describe("buildPreview", () => {
  it("previews every requested platform, publishes only ready ones", async () => {
    const r = await buildPreview({ content: long, platforms: ["twitter", "bluesky", "linkedin", "tiktok"] }, accounts);
    expect(r.targets.map((t) => [t.platform, t.state])).toEqual([
      ["twitter", "no_account"],
      ["bluesky", "ready"],
      ["linkedin", "ready"],
      ["tiktok", "blocked"],
    ]);
    expect(r.targets.find((t) => t.platform === "twitter")?.preview.segments.length).toBeGreaterThan(1);
    expect(r.targets.find((t) => t.platform === "tiktok")?.issues.map((i) => i.code)).toContain("media_required");
    expect(r.publishable).toEqual(["bluesky", "linkedin"]);
    expect(r.payload?.platforms.map((p) => p.accountId)).toEqual(["acc_bs", "acc_li"]);
    expect(r.payload?.publishNow).toBe(true);
  });

  it("returns a hash that survives the JSON round trip through the widget", async () => {
    const r = await buildPreview({ content: long, platforms: ["bluesky"] }, accounts);
    const echoed = JSON.parse(JSON.stringify(r.payload));
    expect(await hashPayload(echoed)).toBe(r.payloadHash);
    expect(await verifyPayload({ payload: echoed, payloadHash: r.payloadHash! })).toBe(true);
  });

  it("changes the hash when anything in the payload changes", async () => {
    const r = await buildPreview({ content: "hello", platforms: ["linkedin"] }, accounts);
    const tampered = { ...r.payload!, content: "hello!" };
    expect(await verifyPayload({ payload: tampered, payloadHash: r.payloadHash! })).toBe(false);
  });

  it("applies inline edits as per-platform overrides", async () => {
    const r = await buildPreview(
      { content: "base", platforms: ["bluesky", "linkedin"], overrides: { linkedin: { content: "edited for LinkedIn" } } },
      accounts,
    );
    expect(r.payload?.platforms.find((p) => p.platform === "linkedin")?.customContent).toBe("edited for LinkedIn");
    expect(r.payload?.platforms.find((p) => p.platform === "bluesky")?.customContent).toBeUndefined();
  });

  it("carries the account's avatar into the preview, never into the payload", async () => {
    const r = await buildPreview({ content: "hi", platforms: ["bluesky"] }, [{ platform: "bluesky", accountId: "acc_bs", username: "demo.bsky.social", avatarUrl: "https://cdn.bsky.app/a.jpg" }]);
    expect(r.targets[0]?.account?.avatarUrl).toBe("https://cdn.bsky.app/a.jpg");
    expect(JSON.stringify(r.payload)).not.toContain("cdn.bsky.app");
  });

  it("has no payload when nothing is publishable", async () => {
    const r = await buildPreview({ content: "hi", platforms: ["twitter", "instagram"] }, accounts);
    expect(r.payload).toBeNull();
    expect(r.payloadHash).toBeNull();
  });

  it("schedules instead of publishing now when scheduledFor is set", async () => {
    const r = await buildPreview({ content: "hi", platforms: ["linkedin"], scheduledFor: "2026-11-10T09:00:00.000Z", timezone: "Europe/Madrid" }, accounts);
    expect(r.payload).toMatchObject({ scheduledFor: "2026-11-10T09:00:00.000Z", timezone: "Europe/Madrid" });
    expect(r.payload?.publishNow).toBeUndefined();
  });
});

describe("canonicalJson", () => {
  it("is independent of key order and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, 1] } })).toBe(canonicalJson({ a: { c: [2, 1] }, b: 1 }));
  });
});
