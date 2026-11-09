import { describe, expect, it } from "vitest";
import { connectQuery, isPublishingAccount, isSettled, moveToDay, normalizePost, summarizeDailyMetrics } from "./index";
import { shouldRetry, ZernioError } from "../provider";

describe("normalizePost", () => {
  it("flattens a populated accountId object to its id (Zernio may return a SocialAccount)", () => {
    const p = normalizePost({ _id: "p", platforms: [{ platform: "twitter", accountId: { _id: "acc_1" } }, { platform: "bluesky", accountId: "acc_2" }] });
    expect(p.platforms?.map((t) => t.accountId)).toEqual(["acc_1", "acc_2"]);
  });
});

describe("isPublishingAccount", () => {
  it("ignores non-publishing connectors and disabled accounts", () => {
    expect(isPublishingAccount({ _id: "a", platform: "twitter", isActive: true })).toBe(true);
    expect(isPublishingAccount({ _id: "b", platform: "whatsapp", isActive: true })).toBe(false);
    expect(isPublishingAccount({ _id: "c", platform: "metaads" })).toBe(false);
    expect(isPublishingAccount({ _id: "d", platform: "linkedin", enabled: false })).toBe(false);
  });
});

describe("isSettled", () => {
  it("waits until every platform is terminal", () => {
    expect(isSettled({ _id: "p", platforms: [{ platform: "twitter", accountId: "a", status: "published" }, { platform: "bluesky", accountId: "b", status: "publishing" }] })).toBe(false);
    expect(isSettled({ _id: "p", platforms: [{ platform: "twitter", accountId: "a", status: "published" }, { platform: "bluesky", accountId: "b", status: "failed" }] })).toBe(true);
  });
  it("does not wait on scheduled posts (their platforms stay pending until the date)", () => {
    expect(isSettled({ _id: "p", status: "scheduled", platforms: [{ platform: "twitter", accountId: "a", status: "pending" }] })).toBe(true);
  });
});

describe("connectQuery", () => {
  it("sends brandName only together with welcome=true (Zernio 400s otherwise)", () => {
    const q = connectQuery({ brandName: "Hostly", primaryColor: "#e8573c", redirectUrl: "https://app.test/x" });
    expect(q.get("welcome")).toBe("true");
    expect(q.get("brandName")).toBe("Hostly");
    expect(q.get("redirect_url")).toBe("https://app.test/x");
  });
  it("drops welcome-screen branding in headless mode (they can't be combined)", () => {
    const q = connectQuery({ brandName: "Hostly", headless: true });
    expect(q.get("headless")).toBe("true");
    expect(q.has("brandName")).toBe(false);
    expect(q.has("welcome")).toBe(false);
  });
});

describe("summarizeDailyMetrics", () => {
  it("fills missing days with zeros and sums engagement", () => {
    const today = new Date("2026-11-09T12:00:00Z");
    const s = summarizeDailyMetrics(
      { dailyData: [{ date: "2026-11-08", postCount: 2, metrics: { impressions: 100, likes: 5, comments: 2, shares: 1 } }], totals: { impressions: 100, clicks: 3 } },
      3,
      today,
    );
    expect(s.daily.map((d) => d.date)).toEqual(["2026-11-07", "2026-11-08", "2026-11-09"]);
    expect(s.daily[1]).toEqual({ date: "2026-11-08", impressions: 100, engagement: 8 });
    expect(s.totals).toEqual({ impressions: 100, engagement: 0, clicks: 3, posts: 2 });
  });
});

describe("shouldRetry", () => {
  it("fails fast on 4xx, retries 5xx/network once", () => {
    expect(shouldRetry(0, new ZernioError(402, { error: "Analytics add-on required" }))).toBe(false);
    expect(shouldRetry(0, new ZernioError(429, null))).toBe(true);
    expect(shouldRetry(0, new ZernioError(502, null))).toBe(true);
    expect(shouldRetry(1, new ZernioError(502, null))).toBe(false);
    expect(shouldRetry(0, new TypeError("fetch failed"))).toBe(true);
  });
});

describe("moveToDay", () => {
  it("keeps the local time of day when moving a post to another date", () => {
    const from = new Date(2026, 10, 10, 9, 30);
    const moved = new Date(moveToDay(from.toISOString(), new Date(2026, 10, 13)));
    expect([moved.getFullYear(), moved.getMonth(), moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([2026, 10, 13, 9, 30]);
  });
});
