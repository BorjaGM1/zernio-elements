"use client";

import { useMemo, type ReactNode } from "react";
import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react";
import { Avatar, HEADING, Notice, PostPreview, PreviewGrid, ROOT, Section, cn, platformName } from "@zernio-elements/react";
import type { ComposerPost } from "@zernio-elements/rules";
import { catalog } from "./catalog";
import { validateCatalogSpec } from "./validate";

/*
 * Every block renders from props only. Styling follows packages/react: --ze-* tokens in Tailwind
 * classes, hairline borders, tabular numbers, no gradients or decoration.
 */

const compact = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : n.toLocaleString("en-US"));
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function BlockTitle({ children, aside }: { children?: ReactNode; aside?: ReactNode }) {
  if (!children && !aside) return null;
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      {children ? <h3 className="text-[13px] font-semibold">{children}</h3> : <span />}
      {aside && <span className="text-xs text-[var(--ze-muted)] tabular-nums">{aside}</span>}
    </div>
  );
}

const TONE: Record<string, { text: string; dot: string; label: string }> = {
  neutral: { text: "text-[var(--ze-fg)]", dot: "bg-[var(--ze-muted)]", label: "Note" },
  info: { text: "text-[var(--ze-info)]", dot: "bg-[var(--ze-info)]", label: "Insight" },
  success: { text: "text-[var(--ze-success)]", dot: "bg-[var(--ze-success)]", label: "Good" },
  warning: { text: "text-[var(--ze-warning)]", dot: "bg-[var(--ze-warning)]", label: "Watch" },
  danger: { text: "text-[var(--ze-danger)]", dot: "bg-[var(--ze-danger)]", label: "Action needed" },
};

const HEALTH: Record<string, { label: string; tone: keyof typeof TONE }> = {
  connected: { label: "Connected", tone: "success" },
  needs_reconnect: { label: "Needs reconnecting", tone: "danger" },
  paused: { label: "Paused", tone: "warning" },
  attention: { label: "Needs attention", tone: "warning" },
  not_connected: { label: "Not connected", tone: "neutral" },
};

const GAP = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;
// Container queries, not viewport breakpoints: the view sits in chat widgets, half-width panels and docs frames.
const COLS = { 1: "", 2: "@xl:grid-cols-2", 3: "@xl:grid-cols-2 @4xl:grid-cols-3", 4: "@md:grid-cols-2 @4xl:grid-cols-4" } as const;

const toPost = (p: { content: string; title?: string; media?: ComposerPost["media"] }): ComposerPost => ({
  content: p.content,
  ...(p.title ? { title: p.title } : {}),
  media: p.media ?? [],
});

export const { registry } = defineRegistry(catalog, {
  components: {
    Stack: ({ props, children }) => (
      <div className={cn("flex flex-col", GAP[props.gap ?? "md"])}>
        {(props.title || props.description) && (
          <header className="flex flex-col gap-1">
            {props.title && <h2 className={cn(HEADING, "text-xl")} style={{ fontSize: "calc(var(--ze-heading-size) + 5px)" }}>{props.title}</h2>}
            {props.description && <p className="max-w-prose text-sm text-[var(--ze-muted)]">{props.description}</p>}
          </header>
        )}
        {children}
      </div>
    ),

    Grid: ({ props, children }) => (
      <div>
        <BlockTitle>{props.title}</BlockTitle>
        <div className={cn("grid grid-cols-1 gap-4", COLS[props.columns])}>{children}</div>
      </div>
    ),

    Section: ({ props, children }) => (
      <Section title={props.title} description={props.description} bodyClassName="flex flex-col gap-5">
        {children}
      </Section>
    ),

    Callout: ({ props }) => {
      const t = TONE[props.tone]!;
      return (
        <div role={props.tone === "danger" ? "alert" : undefined} className="rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-bg)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
            <span className={cn("text-[11px] font-semibold tracking-wide uppercase", t.text)}>{t.label}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold">{props.title}</p>
          {props.body && <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ze-muted)]">{props.body}</p>}
        </div>
      );
    },

    StatTiles: ({ props }) => (
      <div>
        <BlockTitle>{props.title}</BlockTitle>
        {/* gap-px over the border colour draws hairlines between tiles however the row wraps */}
        <dl
          className={cn(
            "grid gap-px overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-border)] @lg:grid-cols-[repeat(var(--n),minmax(0,1fr))]",
            props.items.length > 1 ? "grid-cols-2" : "grid-cols-1",
            // Two columns with an odd count: the last tile takes the whole row instead of leaving an empty cell.
            props.items.length % 2 === 1 && "[&>*:last-child]:col-span-2 @lg:[&>*:last-child]:col-span-1",
          )}
          style={{ ["--n" as string]: props.items.length }}
        >
          {props.items.map((t, i) => (
            <div key={`${t.label}-${i}`} className="flex flex-col gap-1 bg-[var(--ze-bg)] px-4 py-3">
              <dt className="truncate text-xs text-[var(--ze-muted)]">{t.label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className={cn(HEADING, "tabular-nums")} style={{ fontSize: 24 }}>
                  {t.format === "percent" ? `${t.value.toFixed(1)}%` : compact(t.value)}
                </span>
                {t.change !== undefined && (
                  <span className={cn("text-xs font-medium tabular-nums", t.change > 0 ? "text-[var(--ze-success)]" : t.change < 0 ? "text-[var(--ze-danger)]" : "text-[var(--ze-muted)]")}>
                    {t.change > 0 ? "+" : t.change < 0 ? "−" : ""}
                    {Math.abs(t.change).toFixed(Math.abs(t.change) < 10 ? 1 : 0)}%
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    ),

    // Same look as the Analytics card in packages/react: one bar per day, peak in the primary colour.
    DailyBars: ({ props }) => {
      const days = props.days;
      const max = Math.max(...days.map((d) => d.value), 1);
      const best = days.reduce((b, d) => (d.value > b.value ? d : b), days[0]!);
      const total = days.reduce((n, d) => n + d.value, 0);
      return (
        <figure className="flex flex-col gap-2">
          <BlockTitle aside={`${compact(total)} ${props.metric.toLowerCase()} in ${days.length} days`}>{props.title}</BlockTitle>
          <div className="flex h-40 items-end gap-1 border-b border-[var(--ze-border-strong)]" role="img" aria-label={`${props.metric} per day, peak ${best.value} on ${best.date}`}>
            {days.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-[2px]",
                    d === best ? "bg-[var(--ze-primary)]" : "bg-[color-mix(in_srgb,var(--ze-muted)_30%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--ze-muted)_55%,transparent)]",
                  )}
                  style={{ height: `${Math.max((d.value / max) * 100, d.value ? 2 : 0)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-[var(--ze-fg)] px-1.5 py-0.5 text-[10px] whitespace-nowrap text-[var(--ze-bg)] tabular-nums group-hover:block">
                  {d.value.toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>
          <figcaption className="flex justify-between text-[10px] text-[var(--ze-muted)] tabular-nums">
            <span>{shortDate(days[0]!.date)}</span>
            <span>
              {`Peak ${best.value.toLocaleString("en-US")} on ${shortDate(best.date)}`}
            </span>
            <span>{shortDate(days.at(-1)!.date)}</span>
          </figcaption>
        </figure>
      );
    },

    PlatformBreakdown: ({ props }) => {
      const rows = [...props.rows].sort((a, b) => b.value - a.value);
      const total = rows.reduce((n, r) => n + r.value, 0);
      const max = Math.max(rows[0]?.value ?? 0, 1);
      return (
        <div>
          <BlockTitle aside={`${compact(total)} ${props.metric.toLowerCase()}`}>{props.title}</BlockTitle>
          <table className="w-full border-collapse text-[13px]">
            <thead className="sr-only">
              <tr>
                <th>Platform</th>
                <th>{props.metric}</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.platform} className="border-t border-[var(--ze-border)] first:border-t-0">
                  <td className="w-32 py-2.5 pr-3 align-middle">
                    <div className="font-medium">{platformName(r.platform)}</div>
                    {r.posts !== undefined && <div className="text-[11px] text-[var(--ze-muted)] tabular-nums">{`${r.posts} ${r.posts === 1 ? "post" : "posts"}`}</div>}
                  </td>
                  <td className="py-2.5 align-middle">
                    <div className="h-2 w-full rounded-full bg-[var(--ze-fill)]">
                      <div
                        className={cn("h-2 rounded-full", i === 0 ? "bg-[var(--ze-primary)]" : "bg-[color-mix(in_srgb,var(--ze-muted)_45%,transparent)]")}
                        style={{ width: `${Math.max((r.value / max) * 100, r.value ? 1.5 : 0)}%` }}
                      />
                    </div>
                  </td>
                  <td className="w-20 py-2.5 pl-3 text-right align-middle font-medium tabular-nums">{compact(r.value)}</td>
                  <td className="w-14 py-2.5 pl-2 text-right align-middle text-[var(--ze-muted)] tabular-nums">{total ? Math.round((r.value / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    },

    AccountList: ({ props }) => {
      const healthy = props.accounts.filter((a) => a.health === "connected").length;
      return (
        <div>
          <BlockTitle aside={`${healthy} of ${props.accounts.length} healthy`}>{props.title}</BlockTitle>
          <ul className="overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-bg)]">
            {props.accounts.map((a, i) => {
              const h = HEALTH[a.health]!;
              const t = TONE[h.tone]!;
              return (
                <li key={`${a.platform}-${a.handle ?? ""}-${i}`} className="flex items-center gap-3 border-t border-[var(--ze-border)] px-4 py-3 first:border-t-0">
                  <Avatar name={a.handle ?? platformName(a.platform)} size={30} />
                  <div className="min-w-0 flex-1">
                    {/* Not connected: there is no handle, so the platform is the name. */}
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-semibold break-all">
                        {a.handle ? (a.handle.startsWith("@") ? a.handle : `@${a.handle}`) : platformName(a.platform)}
                      </span>
                      {a.handle && <span className="text-xs text-[var(--ze-muted)]">{platformName(a.platform)}</span>}
                    </div>
                    {/* Narrow containers: the status moves under the name so the handle keeps its width. */}
                    <span className={cn("mt-0.5 flex items-center gap-1.5 text-xs font-medium @md:hidden", h.tone === "neutral" ? "text-[var(--ze-muted)]" : t.text)}>
                      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                      {h.label}
                    </span>
                    {a.detail && <p className="mt-0.5 text-xs text-[var(--ze-muted)]">{a.detail}</p>}
                  </div>
                  <span className={cn("hidden shrink-0 items-center gap-1.5 text-xs font-medium @md:flex", h.tone === "neutral" ? "text-[var(--ze-muted)]" : t.text)}>
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                    {h.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    },

    Checklist: ({ props }) => {
      const done = props.items.filter((i) => i.done).length;
      return (
        <div>
          <BlockTitle aside={`${done} of ${props.items.length} done`}>{props.title}</BlockTitle>
          <ul className="flex flex-col">
            {props.items.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex gap-3 border-t border-[var(--ze-border)] py-2.5 first:border-t-0 first:pt-0">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                    item.done ? "border-[var(--ze-primary)] bg-[var(--ze-primary)] text-[var(--ze-primary-fg)]" : "border-[var(--ze-border-strong)]",
                  )}
                >
                  {item.done && (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.5l2.2 2.2L9.5 3.5" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-[13px]", item.done ? "text-[var(--ze-muted)]" : "font-medium")}>
                    <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
                    {item.label}
                  </p>
                  {item.detail && <p className="mt-0.5 text-xs text-[var(--ze-muted)]">{item.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    },

    PostPreview: ({ props }) => <PostPreview post={toPost(props)} platform={props.platform} author={props.author} previewOnly={props.previewOnly ?? false} />,

    PreviewGrid: ({ props }) => <PreviewGrid post={toPost(props)} platforms={props.platforms} author={props.author} previewOnly={props.previewOnly ?? []} />,
  },
});

/**
 * Render a spec with our real components. The spec is validated against the catalog first; an
 * invalid spec renders the validation errors instead, never an unknown or malformed component.
 */
export function CatalogView({ spec, className }: { spec: unknown; className?: string }) {
  const check = useMemo(() => validateCatalogSpec(spec), [spec]);
  if (!check.ok) {
    return (
      <Notice tone="danger" title="This view doesn't match the catalog" className={cn(ROOT, className)}>
        <ul className="text-left">
          {check.errors.slice(0, 8).map((e) => (
            <li key={e}>{e}</li>
          ))}
          {check.errors.length > 8 && <li>and {check.errors.length - 8} more</li>}
        </ul>
      </Notice>
    );
  }
  return (
    <div className={cn(ROOT, "@container", className)}>
      <JSONUIProvider registry={registry}>
        <Renderer spec={check.spec} registry={registry} />
      </JSONUIProvider>
    </div>
  );
}
