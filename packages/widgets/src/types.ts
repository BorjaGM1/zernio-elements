/**
 * Every shape the widgets read from tool results, in one place so it can be aligned with apps/mcp.
 *
 * preview_post / publish_post come from the shared contract in @zernio-elements/rules (mcp.ts).
 * get_analytics / check_accounts are defined here and parsed tolerantly: unknown or missing fields
 * never crash a widget, they just render less.
 */
import type { PreviewPostInput, PreviewResult, PublishPostInput, PublishResult, PublishedTarget } from "@zernio-elements/rules";

export type { PreviewPostInput, PreviewResult, PublishPostInput, PublishResult, PublishedTarget };

/** Any tool result may say it came from fixtures; the widget then labels itself "Mock data". */
export interface MockFlag {
  mock?: boolean;
}

// ---------- get_analytics ----------

export interface AnalyticsTotals {
  impressions: number;
  engagement: number;
  clicks: number;
  posts: number;
}

export interface AnalyticsDay {
  /** YYYY-MM-DD */
  date: string;
  impressions: number;
  engagement: number;
}

export interface AnalyticsPlatform {
  platform: string;
  impressions?: number;
  engagement?: number;
  posts?: number;
}

/**
 * get_analytics structuredContent. The server returns either the numbers (available: true) or
 * { available: false, reason: "analytics_addon_required", message }.
 */
export interface AnalyticsResult extends MockFlag {
  available?: boolean;
  /** True when the profile has no activity and the server returns illustrative numbers. */
  sample?: boolean;
  reason?: string;
  message?: string;
  from?: string;
  to?: string;
  totals: AnalyticsTotals;
  daily: AnalyticsDay[];
  platforms?: AnalyticsPlatform[];
  days?: number;
}

// ---------- check_accounts ----------

export interface AccountHealth {
  platform: string;
  accountId: string;
  name?: string;
  username?: string;
  displayName?: string;
  isActive: boolean;
  needsReconnection: boolean;
  /** Server's overall verdict; when absent, isActive && !needsReconnection. */
  healthy?: boolean;
  connectUrl?: string;
  note?: string;
}

export interface MissingPlatform {
  platform: string;
  name?: string;
  connectUrl?: string;
  /** Why it isn't connected (server field `note`; `reason` accepted too). */
  reason?: string;
}

/** check_accounts structuredContent. */
export interface AccountsResult extends MockFlag {
  profileId?: string;
  accounts: AccountHealth[];
  missing?: MissingPlatform[];
}

// ---------- render_view ----------

/** render_view structuredContent: a json-render spec, already validated server-side against the catalog. */
export interface RenderViewResult extends MockFlag {
  title?: string;
  spec: unknown;
}

/** render_view refusal (isError): structuredContent { error, errors }. */
export interface RenderViewError {
  error: string;
  errors: string[];
}

// ---------- tolerant parsers ----------

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseAnalytics(raw: unknown): AnalyticsResult | null {
  const r = obj(raw);
  if (r.available === false) {
    return {
      available: false,
      reason: str(r.reason),
      message: str(r.message),
      totals: { impressions: 0, engagement: 0, clicks: 0, posts: 0 },
      daily: [],
      days: typeof r.days === "number" ? r.days : undefined,
      mock: r.mock === true,
    };
  }
  if (!("totals" in r) && !("daily" in r)) return null;
  const t = obj(r.totals);
  const daily = arr(r.daily)
    .map((d) => obj(d))
    .filter((d) => typeof d.date === "string")
    .map((d) => ({ date: (d.date as string).slice(0, 10), impressions: num(d.impressions), engagement: num(d.engagement) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    totals: {
      impressions: "impressions" in t ? num(t.impressions) : daily.reduce((s, d) => s + d.impressions, 0),
      engagement: "engagement" in t ? num(t.engagement) : daily.reduce((s, d) => s + d.engagement, 0),
      clicks: num(t.clicks),
      posts: num(t.posts),
    },
    daily,
    platforms: arr(r.platforms)
      .map((p) => obj(p))
      .filter((p) => typeof p.platform === "string")
      .map((p) => ({ platform: p.platform as string, impressions: num(p.impressions), engagement: num(p.engagement), posts: num(p.posts) })),
    days: typeof r.days === "number" ? r.days : daily.length || undefined,
    from: str(r.from),
    to: str(r.to),
    available: true,
    sample: r.sample === true,
    mock: r.mock === true,
  };
}

export function parseAccounts(raw: unknown): AccountsResult | null {
  const r = obj(raw);
  if (!Array.isArray(r.accounts) && !Array.isArray(r.missing)) return null;
  return {
    accounts: arr(r.accounts)
      .map((a) => obj(a))
      .filter((a) => typeof a.platform === "string")
      .map((a) => ({
        platform: a.platform as string,
        accountId: str(a.accountId) ?? str(a._id) ?? str(a.id) ?? "",
        name: str(a.name),
        username: str(a.username),
        displayName: str(a.displayName),
        isActive: a.isActive !== false,
        needsReconnection: a.needsReconnection === true,
        healthy: typeof a.healthy === "boolean" ? a.healthy : undefined,
        connectUrl: str(a.connectUrl),
        note: str(a.note),
      })),
    missing: arr(r.missing)
      .map((m) => obj(m))
      .filter((m) => typeof m.platform === "string")
      .map((m) => ({ platform: m.platform as string, name: str(m.name), connectUrl: str(m.connectUrl), reason: str(m.note) ?? str(m.reason) })),
    profileId: str(r.profileId),
    mock: r.mock === true,
  };
}

export function parseRenderView(raw: unknown): RenderViewResult | null {
  const r = obj(raw);
  if (!r.spec || typeof r.spec !== "object") return null;
  return { title: str(r.title), spec: r.spec, mock: r.mock === true };
}

export function isPreviewResult(v: unknown): v is PreviewResult {
  const r = obj(v);
  return Array.isArray(r.targets) && "payload" in r && typeof r.input === "object";
}

export function isPublishResult(v: unknown): v is PublishResult {
  const r = obj(v);
  return Array.isArray(r.platforms) && typeof r.postId === "string";
}
