/**
 * Fixtures for the dev harness and tests. Previews are built by the real buildPreview from
 * @zernio-elements/rules with fake accounts: no hand-written payloads.
 */
import { buildPreview, type AccountRef, type PreviewPostInput, type PublishPostInput } from "@zernio-elements/rules";
import type { AccountsResult, AnalyticsResult, PublishResult } from "../types";

export const FAKE_ACCOUNTS: AccountRef[] = [
  { platform: "bluesky", accountId: "acc_bluesky_01", username: "ferment.bsky.social" },
  { platform: "linkedin", accountId: "acc_linkedin_01", username: "ferment-kitchen" },
  { platform: "tiktok", accountId: "acc_tiktok_01", username: "fermentkitchen" },
];

export const DEMO_INPUT: PreviewPostInput = {
  content:
    "Our autumn menu starts Thursday. Seven courses built around what the valley gives us in October: wild mushrooms, line-caught hake, roasted squash with brown butter, and the last of the season's figs.\n\nEvery producer is within 80 km of the kitchen, and the natural wines come from our own cellar. 24 seats a night. Reservations are open now.",
  platforms: ["twitter", "instagram", "linkedin", "tiktok", "bluesky"],
};

export const previewFixture = (input: PreviewPostInput = DEMO_INPUT) => buildPreview(input, FAKE_ACCOUNTS);

export function publishFixture({ payload, payloadHash }: PublishPostInput): PublishResult {
  return {
    postId: "post_6f2a91c0",
    status: payload.scheduledFor ? "scheduled" : "published",
    payloadHash,
    platforms: payload.platforms.map((p) => ({
      platform: p.platform,
      accountId: p.accountId,
      status: payload.scheduledFor ? "scheduled" : "published",
      url: payload.scheduledFor
        ? null
        : p.platform === "bluesky"
          ? "https://bsky.app/profile/ferment.bsky.social/post/3m4xexample"
          : `https://www.linkedin.com/feed/update/urn:li:share:7392000000000000000`,
      error: null,
    })),
    warnings: [],
  };
}

export function partialPublishFixture(args: PublishPostInput): PublishResult {
  const r = publishFixture(args);
  return {
    ...r,
    status: "partial",
    platforms: r.platforms.map((p) => (p.platform === "linkedin" ? { ...p, status: "failed", url: null, error: "LinkedIn rejected the post: the access token expired." } : p)),
  };
}

export function analyticsFixture(days = 14): AnalyticsResult {
  const end = new Date("2026-11-08T12:00:00Z");
  const imp = [820, 960, 1240, 1110, 2380, 3150, 1890, 1320, 1180, 1460, 4120, 2690, 1720, 1530, 1390, 1610, 2040, 1880, 1210, 990, 1470, 1920, 2210, 1750, 1340, 1260, 1580, 1830, 2100, 1640];
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(end.getTime() - (days - 1 - i) * 86_400_000);
    const impressions = imp[(i + imp.length - days) % imp.length]!;
    return { date: d.toISOString().slice(0, 10), impressions, engagement: Math.round(impressions * (0.035 + ((i * 7) % 5) / 400)) };
  });
  const impressions = daily.reduce((s, d) => s + d.impressions, 0);
  const engagement = daily.reduce((s, d) => s + d.engagement, 0);
  return {
    available: true,
    from: daily[0]!.date,
    to: daily.at(-1)!.date,
    totals: { impressions, engagement, clicks: Math.round(engagement * 0.31), posts: 9 },
    daily,
    platforms: [
      { platform: "bluesky", impressions: Math.round(impressions * 0.46), engagement: Math.round(engagement * 0.52), posts: 4 },
      { platform: "linkedin", impressions: Math.round(impressions * 0.38), engagement: Math.round(engagement * 0.33), posts: 3 },
      { platform: "threads", impressions: Math.round(impressions * 0.16), engagement: Math.round(engagement * 0.15), posts: 2 },
    ],
    days,
  };
}

/** Raw check_accounts structuredContent, in the server's shape (parsed by parseAccounts). */
export const accountsFixture = {
  profileId: "profile_demo",
  accounts: [
    { accountId: "acc_bluesky_01", platform: "bluesky", name: "Bluesky", username: "ferment.bsky.social", displayName: "Ferment", isActive: true, needsReconnection: false, healthy: true, connectUrl: null, note: null },
    {
      accountId: "acc_linkedin_01",
      platform: "linkedin",
      name: "LinkedIn",
      username: "ferment-kitchen",
      displayName: "Ferment Kitchen",
      isActive: true,
      needsReconnection: true,
      healthy: false,
      connectUrl: "https://zernio.com/connect/linkedin?profileId=demo",
      note: "Token expired",
    },
    { accountId: "acc_tiktok_01", platform: "tiktok", name: "TikTok", username: "fermentkitchen", displayName: "Ferment", isActive: true, needsReconnection: false, healthy: true, connectUrl: null, note: null },
  ],
  missing: [
    { platform: "twitter", name: "X", connectUrl: "https://zernio.com/connect/twitter?profileId=demo", note: "X needs a payment method on the Zernio account." },
    { platform: "instagram", name: "Instagram", connectUrl: "https://zernio.com/connect/instagram?profileId=demo", note: "Requested in the post but not connected." },
  ],
} satisfies Record<string, unknown> & { accounts: unknown[] };

/** get_analytics when the profile has no activity: illustrative numbers, flagged sample: true. */
export const analyticsSampleFixture = (): AnalyticsResult => ({ ...analyticsFixture(14), sample: true });

/** render_view refusal (isError structuredContent). */
export const renderViewErrorFixture = {
  error: "The spec doesn't match the catalog.",
  errors: ['elements.chart: unknown component "LineChart"', 'elements.kpis.props.columns: expected 1, 2, 3 or 4, got 6', "root: element \"summary\" is referenced but not defined"],
};

export const analyticsUnavailableFixture = { available: false, reason: "analytics_addon_required", message: "Post analytics need the Zernio Analytics add-on on this workspace." };

export type { AccountsResult };
