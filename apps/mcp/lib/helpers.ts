/**
 * Small pure helpers copied from packages/react/src/hooks/index.ts (isPublishingAccount, normalizePost,
 * isSettled, summarizeDailyMetrics). That module is "use client" and imports React Query, so importing it
 * here would pull React into the server. Keep these in sync if the hooks change.
 */
import { PLATFORM_IDS } from "@zernio-elements/rules";

export interface Account {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  isActive?: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
}

const PUBLISHING = new Set<string>(PLATFORM_IDS);

/** Accounts we can publish to: a publishing platform, active and enabled. */
export const isPublishingAccount = (a: Account) =>
  PUBLISHING.has(a.platform) && a.isActive !== false && a.enabled !== false;

export interface RawTarget {
  platform?: string;
  accountId?: string | { _id?: string };
  status?: string;
  platformPostUrl?: string | null;
  errorMessage?: string;
  error?: string;
}

export interface RawPost {
  _id?: string;
  status?: string;
  platforms?: RawTarget[];
}

/** Zernio may populate accountId as a SocialAccount. */
export const accountIdOf = (t: RawTarget) => (typeof t.accountId === "object" ? (t.accountId?._id ?? "") : (t.accountId ?? ""));

const TERMINAL = new Set(["published", "failed", "cancelled", "partial"]);
/** Nothing left to wait for: every platform finished, or the post isn't going out now (scheduled/draft). */
export const isSettled = (p: RawPost) =>
  p.status === "scheduled" ||
  p.status === "draft" ||
  ((p.platforms ?? []).length > 0 && (p.platforms ?? []).every((t) => TERMINAL.has(t.status ?? "")));

export interface AnalyticsSummary {
  totals: { impressions: number; engagement: number; clicks: number; posts: number };
  daily: Array<{ date: string; impressions: number; engagement: number }>;
}

export type DailyMetrics = {
  dailyData?: Array<{ date?: string; postCount?: number; metrics?: Record<string, number | undefined> }>;
  totals?: Record<string, number | undefined>;
  platformBreakdown?: Array<Record<string, unknown>>;
};

const engagementOf = (m: Record<string, number | undefined> = {}) =>
  (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);

/** Map GET /v1/analytics/daily-metrics into a fixed-length daily series (missing days are zero). */
export function summarizeDailyMetrics(r: DailyMetrics, days: number, today = new Date()): AnalyticsSummary {
  const byDate = new Map((r.dailyData ?? []).map((d) => [(d.date ?? "").slice(0, 10), d]));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const m = byDate.get(date)?.metrics;
    return { date, impressions: m?.impressions ?? 0, engagement: engagementOf(m) };
  });
  const t = r.totals ?? {};
  return {
    totals: {
      impressions: t.impressions ?? daily.reduce((n, d) => n + d.impressions, 0),
      engagement: t.engagement ?? engagementOf(t),
      clicks: t.clicks ?? 0,
      posts: t.postCount ?? (r.dailyData ?? []).reduce((n, d) => n + (d.postCount ?? 0), 0),
    },
    daily,
  };
}
