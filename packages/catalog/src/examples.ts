import type { PlatformId } from "@zernio-elements/rules";
import type { CatalogSpec } from "./validate";

/*
 * Realistic data for one fictional brand (Bodega Norte, a Ferment customer in Bilbao), shaped like
 * the get_analytics / check_accounts tool results. The examples below are built only from it, and
 * the /compose demo passes it to the model as the DATA section.
 */

const DAILY = [
  { date: "2026-11-02", impressions: 3120, engagement: 141, clicks: 22, posts: 1 },
  { date: "2026-11-03", impressions: 2870, engagement: 118, clicks: 17, posts: 0 },
  { date: "2026-11-04", impressions: 4410, engagement: 236, clicks: 41, posts: 2 },
  { date: "2026-11-05", impressions: 9860, engagement: 612, clicks: 133, posts: 2 },
  { date: "2026-11-06", impressions: 6240, engagement: 355, clicks: 64, posts: 1 },
  { date: "2026-11-07", impressions: 5180, engagement: 287, clicks: 38, posts: 1 },
  { date: "2026-11-08", impressions: 3950, engagement: 174, clicks: 25, posts: 1 },
];

const sum = (k: "impressions" | "engagement" | "clicks" | "posts") => DAILY.reduce((n, d) => n + d[k], 0);

export const EXAMPLE_DATA = {
  brand: { name: "Bodega Norte", handle: "bodeganorte", city: "Bilbao", kind: "restaurant" },
  analytics: {
    from: "2026-11-02",
    to: "2026-11-08",
    totals: { impressions: sum("impressions"), engagement: sum("engagement"), clicks: sum("clicks"), posts: sum("posts") },
    previousTotals: { impressions: 29_870, engagement: 1_402, clicks: 251, posts: 7 },
    daily: DAILY,
    byPlatform: [
      { platform: "instagram" as PlatformId, impressions: 18_940, posts: 4 },
      { platform: "bluesky" as PlatformId, impressions: 7_210, posts: 3 },
      { platform: "linkedin" as PlatformId, impressions: 6_580, posts: 1 },
      { platform: "twitter" as PlatformId, impressions: 2_900, posts: 1 },
    ],
    topPost: { platform: "instagram" as PlatformId, date: "2026-11-05", summary: "Autumn tasting menu announcement, 7 courses from producers within 80 km" },
  },
  accounts: [
    { platform: "bluesky" as PlatformId, handle: "bodeganorte.bsky.social", health: "connected" as const },
    { platform: "instagram" as PlatformId, handle: "bodeganorte", health: "needs_reconnect" as const, detail: "Meta token expired on Nov 6. Scheduled posts will fail until it is reconnected." },
    { platform: "linkedin" as PlatformId, handle: "bodega-norte", health: "connected" as const },
    { platform: "facebook" as PlatformId, handle: "bodeganortebilbao", health: "paused" as const, detail: "Paused by a teammate on Oct 30." },
    { platform: "twitter" as PlatformId, handle: "bodeganorte", health: "connected" as const },
    { platform: "tiktok" as PlatformId, handle: "bodeganorte", health: "not_connected" as const, detail: "Planned for the autumn menu launch." },
  ],
  draft: {
    content:
      "The autumn tasting menu starts Thursday. Seven courses, all from producers within 80 km of the kitchen, paired with natural wines from our cellar.\n\nExpect wild mushrooms from Gorbeia, line-caught hake, and the last of the Getaria txakoli before the harvest closes. Only 24 seats a night, two sittings. Reservations open now.",
    media: [{ url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1080&h=1350&fit=crop", type: "image" as const, width: 1080, height: 1350, alt: "Dining room set for service" }],
    platforms: ["bluesky", "instagram", "linkedin", "tiktok"] as PlatformId[],
  },
};

const D = EXAMPLE_DATA;
const author = { name: D.brand.name, handle: D.brand.handle };
const pct = (now: number, before: number) => Math.round(((now - before) / before) * 1000) / 10;
const rate = (D.analytics.totals.engagement / D.analytics.totals.impressions) * 100;
const prevRate = (D.analytics.previousTotals.engagement / D.analytics.previousTotals.impressions) * 100;

const weeklyReport: CatalogSpec = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { title: "Week of Nov 2 to 8", description: "Bodega Norte across Instagram, Bluesky, LinkedIn and X, compared with the week before." },
      children: ["totals", "daily", "split"],
    },
    totals: {
      type: "StatTiles",
      props: {
        items: [
          { label: "Impressions", value: D.analytics.totals.impressions, change: pct(D.analytics.totals.impressions, D.analytics.previousTotals.impressions) },
          { label: "Engagement", value: D.analytics.totals.engagement, change: pct(D.analytics.totals.engagement, D.analytics.previousTotals.engagement) },
          { label: "Engagement rate", value: Math.round(rate * 10) / 10, format: "percent", change: pct(rate, prevRate) },
          { label: "Link clicks", value: D.analytics.totals.clicks, change: pct(D.analytics.totals.clicks, D.analytics.previousTotals.clicks) },
        ],
      },
      children: [],
    },
    daily: { type: "Section", props: { title: "Impressions per day" }, children: ["bars"] },
    bars: { type: "DailyBars", props: { metric: "Impressions", days: D.analytics.daily.map((d) => ({ date: d.date, value: d.impressions })) }, children: [] },
    split: { type: "Grid", props: { columns: 2 }, children: ["platforms", "takeaways"] },
    platforms: { type: "Section", props: { title: "Where it landed" }, children: ["breakdown"] },
    breakdown: {
      type: "PlatformBreakdown",
      props: { metric: "Impressions", rows: D.analytics.byPlatform.map((p) => ({ platform: p.platform, value: p.impressions, posts: p.posts })) },
      children: [],
    },
    takeaways: { type: "Section", props: { title: "Takeaways" }, children: ["peak", "next"] },
    peak: {
      type: "Callout",
      props: { tone: "success", title: "Thursday's menu post carried the week", body: "9,860 impressions on Nov 5, more than any other day. The Instagram announcement drove most of it." },
      children: [],
    },
    next: {
      type: "Callout",
      props: { tone: "warning", title: "Instagram needs reconnecting", body: "The token expired on Nov 6, so this week's scheduled Instagram posts will fail until it is reconnected." },
      children: [],
    },
  },
};

const launchChecklist: CatalogSpec = {
  root: "page",
  elements: {
    page: {
      type: "Stack",
      props: { title: "Autumn menu launch", description: "One post, four platforms. Previews come from Zernio's rules engine, so cut-offs and thread splits are real." },
      children: ["blocker", "steps-section", "previews-section"],
    },
    blocker: {
      type: "Callout",
      props: {
        tone: "warning",
        title: "Only Bluesky can publish today",
        body: "Instagram needs reconnecting and TikTok isn't connected yet, so both stay preview only until that's fixed. LinkedIn has no account behind it either.",
      },
      children: [],
    },
    "steps-section": { type: "Section", props: { title: "Before Thursday" }, children: ["steps"] },
    steps: {
      type: "Checklist",
      props: {
        items: [
          { label: "Write the announcement", done: true },
          { label: "Pick the hero photo", done: true, detail: "Dining room, 4:5, works for the Instagram crop" },
          { label: "Reconnect Instagram", done: false, detail: "Token expired on Nov 6" },
          { label: "Connect TikTok", done: false, detail: "Planned for this launch, not connected yet" },
          { label: "Approve and schedule for Thursday 10:00", done: false },
        ],
      },
      children: [],
    },
    "previews-section": { type: "Section", props: { title: "Previews", description: "Only Bluesky is connected; the rest are preview only." }, children: ["previews"] },
    previews: {
      type: "PreviewGrid",
      props: {
        content: D.draft.content,
        media: D.draft.media,
        author,
        platforms: D.draft.platforms,
        previewOnly: ["instagram", "linkedin", "tiktok"],
      },
      children: [],
    },
  },
};

const attention = D.accounts.filter((a) => a.health === "needs_reconnect" || a.health === "paused" || a.health === ("attention" as string));
const accountHealth: CatalogSpec = {
  root: "page",
  elements: {
    page: { type: "Stack", props: { title: "Account health", description: "Every account Bodega Norte publishes to, and what needs doing." }, children: ["counts", "urgent", "list"] },
    counts: {
      type: "StatTiles",
      props: {
        items: [
          { label: "Connected", value: D.accounts.filter((a) => a.health === "connected").length },
          { label: "Need action", value: attention.length },
          { label: "Not connected", value: D.accounts.filter((a) => a.health === "not_connected").length },
        ],
      },
      children: [],
    },
    urgent: {
      type: "Callout",
      props: { tone: "danger", title: "Reconnect Instagram before Thursday", body: "It reached 18,940 impressions last week, more than every other platform combined, and the autumn menu post is scheduled there." },
      children: [],
    },
    list: { type: "Section", props: { title: "Accounts" }, children: ["accounts"] },
    accounts: { type: "AccountList", props: { accounts: D.accounts }, children: [] },
  },
};

export interface CatalogExample {
  id: "weekly-report" | "launch-checklist" | "account-health";
  label: string;
  prompt: string;
  spec: CatalogSpec;
}

export const EXAMPLES: CatalogExample[] = [
  { id: "weekly-report", label: "Weekly report", prompt: "How did last week go? Give me a short report I can send to the owner.", spec: weeklyReport },
  { id: "launch-checklist", label: "Launch checklist", prompt: "Get the autumn menu post ready for Bluesky, Instagram, LinkedIn and TikTok. What's left before Thursday?", spec: launchChecklist },
  { id: "account-health", label: "Account health", prompt: "Which of our accounts need attention?", spec: accountHealth },
];
