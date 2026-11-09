import { useState } from "react";
import { FOCUS, cn } from "@zernio-elements/react";
import { SPECS, isPlatformId } from "@zernio-elements/rules";
import type { AnalyticsResult } from "../types";
import { Bone, Header, Message, Shell, Tag, fmtNumber } from "../shared";

const METRICS = [
  { key: "impressions", label: "Impressions" },
  { key: "engagement", label: "Engagement" },
] as const;
type Metric = (typeof METRICS)[number]["key"];

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function Analytics({ data }: { data: AnalyticsResult }) {
  const [metric, setMetric] = useState<Metric>("impressions");
  if (data.available === false) {
    return (
      <Shell>
        <Header title="Analytics" meta={data.mock ? <Tag tone="warning">Mock data</Tag> : undefined} />
        <div className="border-t border-[var(--ze-border)]">
          <Message title={data.reason === "analytics_addon_required" ? "Analytics isn't enabled on this account" : "Analytics isn't available"}>
            {data.message ?? "Zernio returns post analytics once the analytics add-on is active."}
          </Message>
        </div>
      </Shell>
    );
  }
  return <AnalyticsBody data={data} metric={metric} setMetric={setMetric} />;
}

function AnalyticsBody({ data, metric, setMetric }: { data: AnalyticsResult; metric: Metric; setMetric: (m: Metric) => void }) {
  const days = data.days ?? data.daily.length;
  const empty = data.daily.length === 0 || data.daily.every((d) => d.impressions === 0 && d.engagement === 0);
  const rate = data.totals.impressions ? (data.totals.engagement / data.totals.impressions) * 100 : 0;
  const best = data.daily.reduce<AnalyticsResult["daily"][number] | undefined>((b, d) => (!b || d[metric] > b[metric] ? d : b), undefined);

  const tiles = [
    { label: "Impressions", value: fmtNumber(data.totals.impressions) },
    { label: "Engagement", value: fmtNumber(data.totals.engagement), sub: data.totals.impressions ? `${rate.toFixed(1)}% rate` : undefined },
    { label: "Link clicks", value: fmtNumber(data.totals.clicks) },
    { label: "Posts", value: fmtNumber(data.totals.posts) },
  ];

  return (
    <Shell>
      <Header
        title="Analytics"
        meta={
          data.sample || data.mock ? (
            <>
              {data.sample && <Tag>Sample data</Tag>}
              {data.mock && <Tag tone="warning">Mock data</Tag>}
            </>
          ) : undefined
        }
      >
        {data.sample && <span className="block text-[var(--ze-fg)]">No posts in this period yet. Numbers are illustrative.</span>}
        Last {days} days
        {data.daily.length > 0 ? ` · ${shortDate(data.daily[0]!.date)} to ${shortDate(data.daily.at(-1)!.date)}` : ""}
      </Header>

      <dl className="grid grid-cols-2 border-t border-[var(--ze-border)] sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className={cn(
              "flex flex-col gap-0.5 px-4 py-3",
              i % 2 === 1 && "border-l border-[var(--ze-border)]",
              i >= 2 && "border-t border-[var(--ze-border)] sm:border-t-0",
              i === 2 && "sm:border-l",
            )}
          >
            <dt className="text-[12px] leading-4 text-[var(--ze-muted)]">{t.label}</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="text-[20px] leading-7 font-semibold tracking-[-0.01em] tabular-nums">{t.value}</span>
              {t.sub && <span className="text-[11px] text-[var(--ze-muted)] tabular-nums">{t.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 border-t border-[var(--ze-border)] px-4 pt-3 pb-4">
        {empty ? (
          <p className="py-6 text-center text-[12px] text-[var(--ze-muted)]">No activity in this period yet. Numbers appear a few hours after posts go live.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] p-0.5" role="radiogroup" aria-label="Metric">
                {METRICS.map((m) => (
                  <button
                    key={m.key}
                    role="radio"
                    type="button"
                    aria-checked={metric === m.key}
                    onClick={() => setMetric(m.key)}
                    className={cn(
                      FOCUS,
                      "rounded-[5px] px-2.5 py-1 text-[12px] leading-4 font-medium transition-colors",
                      metric === m.key ? "bg-[var(--ze-fill)] text-[var(--ze-fg)]" : "text-[var(--ze-muted)] hover:text-[var(--ze-fg)]",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {best && (
                <span className="text-[12px] text-[var(--ze-muted)] tabular-nums">
                  Peak <span className="font-medium text-[var(--ze-fg)]">{best[metric].toLocaleString("en-US")}</span> on {shortDate(best.date)}
                </span>
              )}
            </div>
            <Bars daily={data.daily} metric={metric} best={best} />
          </>
        )}
      </div>

      {data.platforms && data.platforms.length > 0 && !empty && <Platforms data={data} metric={metric} />}
    </Shell>
  );
}

/** One bar per day: daily totals are discrete counts. The peak is the only filled bar. */
function Bars({ daily, metric, best }: { daily: AnalyticsResult["daily"]; metric: Metric; best?: AnalyticsResult["daily"][number] }) {
  const max = Math.max(...daily.map((d) => d[metric]), 1);
  const [hover, setHover] = useState<string | null>(null);
  const shown = daily.find((d) => d.date === hover);
  return (
    <figure className="flex flex-col gap-1.5">
      <div
        className="relative flex h-28 items-end gap-[3px] border-b border-[var(--ze-border-strong)]"
        role="img"
        aria-label={`${metric} per day${best ? `, peak ${best[metric]} on ${best.date}` : ""}`}
        onMouseLeave={() => setHover(null)}
      >
        {daily.map((d) => (
          <div key={d.date} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(d.date)}>
            <div
              className={cn(
                "w-full rounded-t-[2px] transition-colors",
                d === best ? "bg-[color-mix(in_srgb,var(--ze-fg)_82%,transparent)]" : hover === d.date ? "bg-[color-mix(in_srgb,var(--ze-muted)_60%,transparent)]" : "bg-[color-mix(in_srgb,var(--ze-muted)_28%,transparent)]",
              )}
              style={{ height: `${Math.max((d[metric] / max) * 100, d[metric] ? 2 : 0)}%` }}
            />
          </div>
        ))}
        {shown && (
          <span className="pointer-events-none absolute top-0 right-0 rounded-[4px] bg-[var(--ze-fg)] px-1.5 py-0.5 text-[11px] text-[var(--ze-bg)] tabular-nums">
            {shortDate(shown.date)} · {shown[metric].toLocaleString("en-US")}
          </span>
        )}
      </div>
      <figcaption className="flex justify-between text-[11px] text-[var(--ze-muted)] tabular-nums">
        <span>{shortDate(daily[0]!.date)}</span>
        <span>{shortDate(daily.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}

function Platforms({ data, metric }: { data: AnalyticsResult; metric: Metric }) {
  const rows = [...(data.platforms ?? [])].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const max = Math.max(...rows.map((r) => r[metric] ?? 0), 1);
  return (
    <div className="border-t border-[var(--ze-border)] px-4 py-3">
      <h2 className="mb-2 text-[12px] font-medium text-[var(--ze-muted)]">By platform</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.platform} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-[12px]">
            <span className="truncate font-medium">{isPlatformId(r.platform) ? SPECS[r.platform].name : r.platform}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[var(--ze-fill)]">
              <span className="block h-full rounded-full bg-[color-mix(in_srgb,var(--ze-fg)_70%,transparent)]" style={{ width: `${((r[metric] ?? 0) / max) * 100}%` }} />
            </span>
            <span className="text-[var(--ze-muted)] tabular-nums">{fmtNumber(r[metric] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Loading analytics">
        <Header title="Analytics">
          <Bone className="mt-1 h-3 w-40" />
        </Header>
        <div className="grid grid-cols-2 border-t border-[var(--ze-border)] sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn("flex flex-col gap-2 px-4 py-3", i % 2 === 1 && "border-l border-[var(--ze-border)]", i >= 2 && "border-t border-[var(--ze-border)] sm:border-t-0", i === 2 && "sm:border-l")}>
              <Bone className="h-3 w-16" />
              <Bone className="h-5 w-12" />
            </div>
          ))}
        </div>
        <div className="flex h-[172px] items-end gap-[3px] border-t border-[var(--ze-border)] px-4 pt-12 pb-8">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="flex h-full flex-1 items-end">
              <Bone className="w-full rounded-b-none" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function AnalyticsError({ message }: { message: string }) {
  return (
    <Shell>
      <Message tone="danger" title="Couldn't load analytics">
        {message}
      </Message>
    </Shell>
  );
}
