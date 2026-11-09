"use client";

import { useState } from "react";
import { useAnalytics, type AnalyticsSummary } from "../hooks";
import { ErrorNotice, HEADING, Notice, Section, Skeleton, cn } from "./ui";

const METRICS = [
  { key: "impressions", label: "Impressions" },
  { key: "engagement", label: "Engagement" },
] as const;

const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : n.toLocaleString());

export function Analytics({ days = 14 }: { days?: number }) {
  const q = useAnalytics({ days });
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("impressions");

  return (
    <Section title="Analytics" description={`Last ${days} days`}>
      {q.isError ? (
        <ErrorNotice error={q.error} onRetry={() => q.refetch()} title="Couldn't load analytics" />
      ) : !q.data ? (
        <div className="flex flex-col gap-5" aria-label="Loading analytics">
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-40" />
        </div>
      ) : q.data.daily.every((d) => d.impressions === 0 && d.engagement === 0) ? (
        <Notice title="No activity yet">Numbers appear here a few hours after your first posts go live.</Notice>
      ) : (
        <Body data={q.data} metric={metric} setMetric={setMetric} />
      )}
    </Section>
  );
}

function Body({
  data,
  metric,
  setMetric,
}: {
  data: AnalyticsSummary;
  metric: "impressions" | "engagement";
  setMetric: (m: "impressions" | "engagement") => void;
}) {
  const tiles = [
    { label: "Impressions", value: data.totals.impressions },
    { label: "Engagement", value: data.totals.engagement },
    { label: "Link clicks", value: data.totals.clicks },
    { label: "Posts", value: data.totals.posts },
  ];
  const rate = data.totals.impressions ? (data.totals.engagement / data.totals.impressions) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] sm:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className={cn("flex flex-col gap-1 px-4 py-3", i > 0 && "border-l border-[var(--ze-border)]", i === 2 && "max-sm:border-l-0 max-sm:border-t", i === 3 && "max-sm:border-t")}>
            <dt className="text-xs text-[var(--ze-muted)]">{t.label}</dt>
            <dd className={cn(HEADING, "text-2xl tabular-nums")} style={{ fontSize: 24 }}>
              {fmt(t.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-1" role="tablist" aria-label="Metric">
            {METRICS.map((m) => (
              <button
                key={m.key}
                role="tab"
                type="button"
                aria-selected={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn(
                  "rounded-[var(--ze-radius-sm)] px-2.5 py-1 text-xs font-medium",
                  metric === m.key ? "bg-[var(--ze-fill)] text-[var(--ze-fg)]" : "text-[var(--ze-muted)] hover:text-[var(--ze-fg)]",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--ze-muted)] tabular-nums">{rate.toFixed(1)}% engagement rate</span>
        </div>
        <Bars daily={data.daily} metric={metric} />
      </div>
    </div>
  );
}

/** One bar per day. Bars, not a line: daily totals are discrete counts. */
function Bars({ daily, metric }: { daily: AnalyticsSummary["daily"]; metric: "impressions" | "engagement" }) {
  const max = Math.max(...daily.map((d) => d[metric]), 1);
  const best = daily.reduce((b, d) => (d[metric] > b[metric] ? d : b), daily[0]!);
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-1 border-b border-[var(--ze-border-strong)]" role="img" aria-label={`${metric} per day, peak ${best[metric]} on ${best.date}`}>
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn("w-full rounded-t-[2px]", d === best ? "bg-[var(--ze-primary)]" : "bg-[color-mix(in_srgb,var(--ze-muted)_30%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--ze-muted)_55%,transparent)]")}
              style={{ height: `${Math.max((d[metric] / max) * 100, d[metric] ? 2 : 0)}%` }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-[var(--ze-fg)] px-1.5 py-0.5 text-[10px] whitespace-nowrap text-[var(--ze-bg)] tabular-nums group-hover:block">
              {d[metric].toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="flex justify-between text-[10px] text-[var(--ze-muted)] tabular-nums">
        <span>{shortDate(daily[0]!.date)}</span>
        <span>
          Peak {best[metric].toLocaleString()} on {shortDate(best.date)}
        </span>
        <span>{shortDate(daily.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
