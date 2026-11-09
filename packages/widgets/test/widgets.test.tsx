import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TOOL_NAMES, hashPayload } from "@zernio-elements/rules";
import { Analytics } from "../src/analytics/Analytics";
import { DEMO_INPUT, accountsFixture, analyticsFixture, analyticsSampleFixture, analyticsUnavailableFixture, partialPublishFixture, previewFixture, publishFixture } from "../src/harness/fixtures";
import { authorFor, defaultTarget, editArgs, orderTargets, outcomeOf, publishArgs, publishLabel, runEdit, runPublish, stateDetail, stateOf, summary } from "../src/preview-post/logic";
import { PreviewPost, publishedSummary, publishedTitle } from "../src/preview-post/PreviewPost";
import { unwrapResult, type HostActions } from "../src/bridge";
import { parseAccounts, parseAnalytics } from "../src/types";

function fakeHost(answer: (name: string, args: Record<string, unknown>) => unknown) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const actions: HostActions = {
    callTool: async (name, args) => {
      calls.push({ name, args });
      return answer(name, args);
    },
    openLink: async () => {},
    tellModel: () => {},
  };
  return { calls, actions };
}

describe("preview-post: inline edit", () => {
  it("re-runs preview_post with the original input and the platform override merged in", async () => {
    const base = await previewFixture({ ...DEMO_INPUT, overrides: { bluesky: { content: "kept" }, linkedin: { title: "kept title" } } });
    const args = editArgs(base, "linkedin", "edited for LinkedIn");
    expect(args).toEqual({
      ...base.input,
      overrides: { bluesky: { content: "kept" }, linkedin: { title: "kept title", content: "edited for LinkedIn" } },
    });
    // The original result is not mutated.
    expect(base.input.overrides?.linkedin).toEqual({ title: "kept title" });
  });

  it("calls the preview tool through the host and returns the new result (new payload + hash)", async () => {
    const base = await previewFixture();
    const next = await previewFixture(editArgs(base, "linkedin", "Short and sweet."));
    const { calls, actions } = fakeHost(() => next);
    const out = await runEdit(actions, base, "linkedin", "Short and sweet.");
    expect(calls).toEqual([{ name: TOOL_NAMES.preview, args: editArgs(base, "linkedin", "Short and sweet.") }]);
    expect(out.payloadHash).not.toBe(base.payloadHash);
    expect(out.payload?.platforms.find((p) => p.platform === "linkedin")?.customContent).toBe("Short and sweet.");
  });
});

describe("preview-post: publish", () => {
  it("sends exactly result.payload and result.payloadHash, unchanged", async () => {
    const result = await previewFixture();
    const before = JSON.stringify(result.payload);
    const { calls, actions } = fakeHost((_n, args) => publishFixture(args as never));
    await runPublish(actions, result);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe(TOOL_NAMES.publish);
    expect(Object.keys(calls[0]!.args).sort()).toEqual(["payload", "payloadHash"]);
    expect(calls[0]!.args.payload).toBe(result.payload); // same object, not a rebuilt copy
    expect(calls[0]!.args).toEqual({ payload: result.payload, payloadHash: result.payloadHash });
    expect(JSON.stringify(calls[0]!.args.payload)).toBe(before);
    expect(await hashPayload(JSON.parse(JSON.stringify(calls[0]!.args.payload)))).toBe(result.payloadHash);
  });

  it("labels the button with the publishable count, or Schedule when scheduled", async () => {
    const now = await previewFixture();
    expect(publishLabel(now)).toBe("Publish 2");
    const later = await previewFixture({ ...DEMO_INPUT, scheduledFor: "2026-11-12T09:00:00.000Z" });
    expect(publishLabel(later)).toBe("Schedule 2");
  });

  it("is disabled when payload is null, and has no publish args", async () => {
    const result = await previewFixture({ ...DEMO_INPUT, platforms: ["twitter", "instagram"] });
    expect(result.payload).toBeNull();
    expect(publishArgs(result)).toBeNull();
    const { actions } = fakeHost(() => {
      throw new Error("must not be called");
    });
    await expect(runPublish(actions, result)).rejects.toThrow("Nothing to publish");
    const html = renderToStaticMarkup(<PreviewPost result={result} actions={actions} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Publish 0<\/button>/);
    expect(html).toContain("Nothing can be published yet");
  });

  it("enables Publish when something is publishable", async () => {
    const result = await previewFixture();
    const html = renderToStaticMarkup(<PreviewPost result={result} actions={fakeHost(() => null).actions} />);
    const button = html.match(/<button[^>]*>Publish 2<\/button>/)?.[0];
    expect(button).toBeDefined();
    expect(button).not.toContain('disabled=""');
  });

  it("summarises the targets in one line", async () => {
    expect(summary(await previewFixture())).toBe("Ready for LinkedIn and Bluesky · X, Instagram preview only · TikTok needs an image or video");
  });
});

describe("preview-post: ordering, author, outcome", () => {
  it("lists ready, then blocked, then preview-only, keeping request order, and selects the first ready", async () => {
    const r = await previewFixture();
    expect(r.targets.map((t) => t.platform)).toEqual(["twitter", "instagram", "linkedin", "tiktok", "bluesky"]);
    expect(orderTargets(r.targets).map((t) => t.platform)).toEqual(["linkedin", "bluesky", "tiktok", "twitter", "instagram"]);
    expect(defaultTarget(r.targets)).toBe("linkedin");
    const none = await previewFixture({ ...DEMO_INPUT, platforms: ["twitter", "instagram"] });
    expect(defaultTarget(none.targets)).toBe("twitter");
  });

  it("uses the first connected account as the author for every preview", async () => {
    expect(authorFor(await previewFixture())).toEqual({ name: "Ferment Kitchen", handle: "ferment-kitchen" });
    const bsky = await previewFixture({ ...DEMO_INPUT, platforms: ["twitter", "bluesky"] });
    expect(authorFor(bsky)).toEqual({ name: "Ferment", handle: "ferment.bsky.social" });
    // A preview-only target (no account) gets the short handle, the account's own target keeps its full handle.
    const own = bsky.targets.find((t) => t.account)!;
    expect(authorFor(bsky, { account: null })).toEqual({ name: "Ferment", handle: "ferment" });
    expect(authorFor(bsky, own).handle).toBe("ferment.bsky.social");
    const withAvatar = { ...bsky, targets: bsky.targets.map((t) => (t.account ? { ...t, account: { ...t.account, avatarUrl: "https://cdn.bsky.app/a.jpg" } } : t)) };
    expect(authorFor(withAvatar, { account: null }).avatar).toBe("https://cdn.bsky.app/a.jpg");
    const none = await previewFixture({ ...DEMO_INPUT, platforms: ["twitter"] });
    expect(authorFor(none)).toEqual({ name: "Your brand", handle: "yourbrand" });
  });

  it("labels platforms Published / Failed after publish", async () => {
    const r = await previewFixture();
    const out = partialPublishFixture(publishArgs(r)!);
    const li = r.targets.find((t) => t.platform === "linkedin")!;
    const bs = r.targets.find((t) => t.platform === "bluesky")!;
    expect(outcomeOf(out, "bluesky")).toBe("published");
    expect(stateOf(bs, outcomeOf(out, "bluesky"))).toEqual({ label: "Published", tone: "success" });
    expect(stateDetail(bs, "published")).toBe("Published as @ferment.bsky.social");
    expect(stateOf(li, outcomeOf(out, "linkedin"))).toEqual({ label: "Failed", tone: "danger" });
    expect(outcomeOf(out, "twitter")).toBeUndefined();
  });

  it("never says a post is live when the server runs on demo data", async () => {
    const r = await previewFixture();
    const out = publishFixture(publishArgs(r)!);
    expect(publishedTitle(out)).toBe("Published");
    expect(publishedSummary(out, r.payloadHash)).toMatch(/^Live on /);
    expect(publishedTitle(out, true)).toBe("Demo: nothing was posted");
    expect(publishedSummary(out, r.payloadHash, true)).toMatch(/^Would go to /);
    expect(publishedSummary(out, r.payloadHash, true)).not.toContain("Live on");
  });
});

describe("bridge + shapes", () => {
  it("surfaces publish_post refusals from structuredContent { error, errors }", () => {
    expect(() =>
      unwrapResult({ isError: true, structuredContent: { error: "Payload hash mismatch.", errors: ["Bluesky: session expired"] }, content: [] }),
    ).toThrow("Payload hash mismatch. Bluesky: session expired");
    expect(() => unwrapResult({ isError: true, content: [{ type: "text", text: "boom" }] })).toThrow("boom");
  });

  it("parses the server's check_accounts shape", () => {
    const r = parseAccounts(accountsFixture)!;
    expect(r.accounts.map((a) => [a.platform, a.healthy, a.note ?? null])).toEqual([
      ["bluesky", true, null],
      ["linkedin", false, "Token expired"],
      ["tiktok", true, null],
    ]);
    expect(r.missing?.[0]).toMatchObject({ platform: "twitter", name: "X", reason: "X needs a payment method on the Zernio account." });
  });

  it("flags sample analytics and labels them in the widget", () => {
    const data = parseAnalytics(analyticsSampleFixture())!;
    expect(data.sample).toBe(true);
    const html = renderToStaticMarkup(<Analytics data={data} />);
    expect(html).toContain("Sample data");
    expect(html).toContain("No posts in this period yet. Numbers are illustrative.");
    expect(renderToStaticMarkup(<Analytics data={parseAnalytics(analyticsFixture(14))!} />)).not.toContain("Sample data");
  });

  it("parses get_analytics when the add-on is missing", () => {
    expect(parseAnalytics(analyticsUnavailableFixture)).toMatchObject({ available: false, reason: "analytics_addon_required" });
    expect(parseAnalytics({ days: 7, available: true, totals: { impressions: 10 }, daily: [{ date: "2026-11-01", impressions: 10, engagement: 1 }] })).toMatchObject({
      totals: { impressions: 10, engagement: 1, clicks: 0, posts: 0 },
      daily: [{ date: "2026-11-01", impressions: 10, engagement: 1 }],
    });
  });
});
