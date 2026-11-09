"use client";

import { useState } from "react";
import { moveToDay, postDate, usePosts, useUpdatePost, type Post } from "../hooks";
import { Button, ErrorNotice, Section, Skeleton, cn, errorMessage, platformName } from "./ui";

const STATUS_TONE: Record<string, string> = {
  published: "text-[var(--ze-success)]",
  failed: "text-[var(--ze-danger)]",
  partial: "text-[var(--ze-warning)]",
  scheduled: "text-[var(--ze-info)]",
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * A week of scheduled and published posts. Starts yesterday so "just published" stays visible.
 * Drag a scheduled post to another day to reschedule it (PUT /v1/posts/{id}, same time of day).
 */
export function Calendar({ days = 7 }: { days?: number }) {
  const posts = usePosts();
  const update = useUpdatePost();
  const [offset, setOffset] = useState(0);
  const [over, setOver] = useState<string | null>(null);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1 + offset * days);
  const cols = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = dayKey(new Date());

  const byDay = new Map<string, Post[]>();
  for (const p of posts.data ?? []) {
    const iso = postDate(p);
    if (!iso) continue;
    const k = dayKey(new Date(iso));
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  const visible = cols.reduce((n, d) => n + (byDay.get(dayKey(d))?.length ?? 0), 0);
  const range = `${cols[0]!.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${cols.at(-1)!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Section
      title="Calendar"
      description={posts.data ? `${range} · ${visible} post${visible === 1 ? "" : "s"}` : range}
      action={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)}>
            ‹
          </Button>
          <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(0)}>
            This week
          </Button>
          <Button size="sm" variant="ghost" aria-label="Next week" onClick={() => setOffset((o) => o + 1)}>
            ›
          </Button>
        </div>
      }
      bodyClassName="p-0"
    >
      {posts.isError ? (
        <div className="p-5">
          <ErrorNotice error={posts.error} onRetry={() => posts.refetch()} title="Couldn't load posts" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] divide-x divide-[var(--ze-border)]" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }}>
            {cols.map((d) => {
              const k = dayKey(d);
              const items = (byDay.get(k) ?? []).sort((a, b) => (postDate(a) ?? "").localeCompare(postDate(b) ?? ""));
              const past = d.getTime() < new Date().setHours(0, 0, 0, 0);
              return (
                <div
                  key={k}
                  onDragOver={(e) => {
                    if (past || !e.dataTransfer.types.includes("text/x-zernio-post")) return;
                    e.preventDefault();
                    setOver(k);
                  }}
                  onDragLeave={() => setOver((o) => (o === k ? null : o))}
                  onDrop={(e) => {
                    setOver(null);
                    const id = e.dataTransfer.getData("text/x-zernio-post");
                    const post = posts.data?.find((p) => p._id === id);
                    if (!post?.scheduledFor || dayKey(new Date(post.scheduledFor)) === k) return;
                    update.mutate({ id, scheduledFor: moveToDay(post.scheduledFor, d) });
                  }}
                  className={cn(
                    "flex min-h-72 flex-col transition-colors",
                    k === today && "bg-[var(--ze-surface)]",
                    over === k && "bg-[var(--ze-fill)] outline-2 -outline-offset-2 outline-dashed outline-[var(--ze-border-strong)]",
                  )}
                >
                  <div className="flex items-baseline justify-between border-b border-[var(--ze-border)] px-3 py-2.5">
                    <span className="text-[11px] font-medium tracking-wide text-[var(--ze-muted)] uppercase">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span className={cn("text-sm tabular-nums", k === today ? "font-semibold" : "text-[var(--ze-muted)]")}>{d.getDate()}</span>
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    {posts.isPending && k === today && (
                      <>
                        <Skeleton className="h-16" />
                        <Skeleton className="h-12" />
                      </>
                    )}
                    {items.map((p) => (
                      <PostCard key={p._id} post={p} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {update.isError && (
        <p role="alert" className="border-t border-[var(--ze-border)] px-5 py-3 text-xs text-[var(--ze-danger)]">
          Couldn't reschedule: {errorMessage(update.error)}
        </p>
      )}
      {posts.data && visible === 0 && (
        <p className="border-t border-[var(--ze-border)] px-5 py-3 text-xs text-[var(--ze-muted)]">
          Nothing scheduled this week. Posts you schedule from the composer show up here.
        </p>
      )}
    </Section>
  );
}

function PostCard({ post }: { post: Post }) {
  const iso = postDate(post);
  const url = post.platforms?.find((t) => t.platformPostUrl)?.platformPostUrl;
  const platforms = [...new Set((post.platforms ?? []).map((t) => t.platform))];
  const movable = post.status === "scheduled";
  return (
    <article
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/x-zernio-post", post._id);
        e.dataTransfer.effectAllowed = "move";
      }}
      title={movable ? "Drag to another day to reschedule" : undefined}
      className={cn(
        "rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-bg)] p-2 text-[11px] leading-snug",
        movable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1 tabular-nums">
        <span className="font-semibold">{iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""}</span>
        <span className={cn("capitalize", STATUS_TONE[post.status ?? ""] ?? "text-[var(--ze-muted)]")}>{post.status}</span>
      </div>
      <p className="line-clamp-3">{post.title || post.content}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[var(--ze-muted)]">
        {platforms.map((p) => (
          <span key={p}>{platformName(p)}</span>
        ))}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="ml-auto font-medium text-[var(--ze-fg)] underline underline-offset-2">
            View
          </a>
        )}
      </div>
    </article>
  );
}
