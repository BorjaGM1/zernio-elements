"use client";

import type { ReactNode } from "react";
import { adapt, SPECS, validatePlatform, type ComposerPost, type MediaInput, type PlatformId } from "@zernio-elements/rules";
import { Avatar, Card, Notice, cn } from "./ui";

export interface PreviewAuthor {
  name: string;
  handle: string;
  avatar?: string;
}

const DEFAULT_AUTHOR: PreviewAuthor = { name: "Your Brand", handle: "yourbrand" };

/** Feed crop per platform, as width/height. */
const CROP: Partial<Record<PlatformId, string>> = {
  instagram: "aspect-[4/5]",
  tiktok: "aspect-[9/16]",
  youtube: "aspect-video",
  pinterest: "aspect-[2/3]",
  snapchat: "aspect-[9/16]",
  threads: "aspect-[4/5]",
};

const MORE: Partial<Record<PlatformId, string>> = {
  linkedin: "…see more",
  facebook: "… See more",
  instagram: "… more",
  tiktok: "… more",
  youtube: "…more",
};

/**
 * How the post will look in each feed.
 * Layouts are faithful *approximations* (truncation point, crop, thread chain, title placement),
 * deliberately neutral: no platform logos, colors or copied UI.
 */
export function PostPreview({
  post,
  platform,
  author = DEFAULT_AUTHOR,
  previewOnly = false,
}: {
  post: ComposerPost;
  platform: PlatformId;
  author?: PreviewAuthor;
  /** No account behind it: label the card so nobody expects it to publish. */
  previewOnly?: boolean;
}) {
  const a = adapt(post, platform);
  const spec = SPECS[platform];
  const blocking = validatePlatform(post, platform).filter((i) => i.severity === "error");
  const over = a.count > a.limit && !spec.text.supportsThreads;

  const meta =
    a.segments.length > 1 ? `Thread · ${a.segments.length} posts` : `${a.count.toLocaleString()} / ${a.limit.toLocaleString()}`;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex h-9 items-center justify-between border-b border-[var(--ze-border)] bg-[var(--ze-surface)] px-3">
        <span className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold tracking-wide uppercase">{spec.name}</span>
          {previewOnly && <span className="text-[10px] text-[var(--ze-muted)]">Preview only</span>}
        </span>
        <span className={cn("text-[11px] text-[var(--ze-muted)] tabular-nums", over && "font-semibold text-[var(--ze-danger)]")}>{meta}</span>
      </div>
      <div className="flex-1 p-3.5">
        <Body platform={platform} a={a} author={author} />
      </div>
      {blocking.length > 0 && (
        <div className="border-t border-[var(--ze-border)] px-3.5 py-2 text-[11px] text-[var(--ze-danger)]">
          {blocking.map((i) => i.message).join(" ")}
        </div>
      )}
    </Card>
  );
}

type Adapted = ReturnType<typeof adapt>;

function Body({ platform, a, author }: { platform: PlatformId; a: Adapted; author: PreviewAuthor }) {
  const spec = SPECS[platform];

  // X, Threads, Bluesky: a chain of posts joined by a line between avatars.
  if (spec.text.supportsThreads) {
    return (
      <ol className="flex flex-col">
        {a.segments.map((seg, i) => (
          <li key={i} className="relative flex gap-2.5 pb-3 last:pb-0">
            {i < a.segments.length - 1 && <span aria-hidden className="absolute top-9 bottom-0 left-[15px] w-px bg-[var(--ze-border-strong)]" />}
            <Avatar name={author.name} src={author.avatar} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 text-[13px] leading-tight">
                <span className="truncate font-semibold">{author.name}</span>
                <span className="truncate text-[var(--ze-muted)]">@{author.handle}</span>
              </div>
              <Text className="mt-0.5">{seg || <Placeholder />}</Text>
              {i === 0 && a.media.length > 0 && <MediaGrid media={a.media} platform={platform} className="mt-2" />}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  // Media-first feeds: the crop leads, caption follows (or overlays, on vertical video).
  if (platform === "tiktok" || platform === "snapchat") {
    return (
      <div className={cn("relative mx-auto w-full max-w-[220px] overflow-hidden rounded-[var(--ze-radius-sm)] bg-[var(--ze-fill)]", CROP[platform])}>
        {a.media[0] ? <MediaItem m={a.media[0]} /> : <MissingMedia platform={platform} />}
        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2.5 text-[12px] leading-snug text-white">
          <div className="font-semibold">@{author.handle}</div>
          <Truncated a={a} platform={platform} />
        </div>
      </div>
    );
  }

  if (platform === "instagram" || platform === "pinterest") {
    return (
      <div className="flex flex-col gap-2.5">
        {platform === "instagram" && <AuthorRow author={author} compact />}
        <div className={cn("overflow-hidden rounded-[var(--ze-radius-sm)] bg-[var(--ze-fill)]", CROP[platform], platform === "pinterest" && "mx-auto w-full max-w-[220px]")}>
          {a.media[0] ? <MediaItem m={a.media[0]} /> : <MissingMedia platform={platform} />}
        </div>
        {a.media.length > 1 && platform === "instagram" && (
          <div className="flex justify-center gap-1" aria-label={`${a.media.length} items`}>
            {a.media.map((m, i) => (
              <span key={m.url} className={cn("h-1.5 w-1.5 rounded-full", i === 0 ? "bg-[var(--ze-fg)]" : "bg-[var(--ze-border-strong)]")} />
            ))}
          </div>
        )}
        {platform === "pinterest" && <div className="text-sm font-semibold">{a.title || <Placeholder>Add a title</Placeholder>}</div>}
        <Text>
          {platform === "instagram" && <span className="mr-1 font-semibold">{author.handle}</span>}
          <Truncated a={a} platform={platform} />
        </Text>
      </div>
    );
  }

  if (platform === "youtube") {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="aspect-video overflow-hidden rounded-[var(--ze-radius-sm)] bg-[var(--ze-fill)]">
          {a.media[0] ? <MediaItem m={a.media[0]} /> : <MissingMedia platform={platform} />}
        </div>
        <div className="flex gap-2.5">
          <Avatar name={author.name} src={author.avatar} size={28} />
          <div className="min-w-0">
            <div className={cn("text-sm leading-snug font-semibold", !a.title && "text-[var(--ze-danger)]")}>{a.title || "Missing title"}</div>
            <div className="mt-0.5 text-xs text-[var(--ze-muted)]">{author.name}</div>
            <Text className="mt-1.5 text-xs text-[var(--ze-muted)]">
              <Truncated a={a} platform={platform} />
            </Text>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "reddit") {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--ze-muted)]">r/yoursubreddit · u/{author.handle}</div>
        <div className={cn("text-[15px] leading-snug font-semibold", !a.title && "text-[var(--ze-danger)]")}>{a.title || "Missing title"}</div>
        {a.media[0] && (
          <div className="aspect-video overflow-hidden rounded-[var(--ze-radius-sm)] bg-[var(--ze-fill)]">
            <MediaItem m={a.media[0]} />
          </div>
        )}
        <Text>{a.text || <Placeholder />}</Text>
      </div>
    );
  }

  // Text-first feeds: LinkedIn, Facebook, Telegram, Discord, Slack, Google Business.
  return (
    <div className="flex flex-col gap-2.5">
      <AuthorRow author={author} subtitle={platform === "linkedin" ? "Company page · 1h" : "Just now"} />
      <Text>
        <Truncated a={a} platform={platform} />
      </Text>
      {a.media.length > 0 && <MediaGrid media={a.media} platform={platform} />}
      {a.links[0] && a.media.length === 0 && <LinkCard url={a.links[0]} />}
    </div>
  );
}

function AuthorRow({ author, subtitle, compact }: { author: PreviewAuthor; subtitle?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={author.name} src={author.avatar} size={compact ? 28 : 36} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-semibold">{compact ? author.handle : author.name}</div>
        {subtitle && <div className="truncate text-[11px] text-[var(--ze-muted)]">{subtitle}</div>}
      </div>
    </div>
  );
}

function Text({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] leading-[1.45] break-words whitespace-pre-wrap", className)}>{children}</p>;
}

function Placeholder({ children = "Nothing to show yet" }: { children?: ReactNode }) {
  return <span className="text-[var(--ze-muted)] italic">{children}</span>;
}

/** The feed's "...more" cut, or the full text when it fits. Highlights text beyond the hard limit. */
function Truncated({ a, platform }: { a: Adapted; platform: PlatformId }) {
  if (!a.text) return <Placeholder />;
  if (a.preview.truncated) {
    return (
      <>
        {a.preview.visible}
        <span className="opacity-60">{MORE[platform] ?? "… more"}</span>
      </>
    );
  }
  return <>{a.text}</>;
}

function MediaItem({ m }: { m: MediaInput }) {
  return m.type === "video" ? (
    <video src={m.url} muted playsInline className="h-full w-full object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
  );
}

function MediaGrid({ media, platform, className }: { media: MediaInput[]; platform: PlatformId; className?: string }) {
  const shown = media.slice(0, 4);
  return (
    <div
      className={cn(
        "grid gap-0.5 overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)]",
        shown.length > 1 && "grid-cols-2",
        className,
      )}
    >
      {shown.map((m, i) => (
        <div
          key={m.url}
          className={cn(
            "relative bg-[var(--ze-fill)]",
            shown.length === 1 ? cn(CROP[platform] ?? "aspect-video", "max-h-72 w-full") : "aspect-square",
            shown.length === 3 && i === 0 && "row-span-2 aspect-auto",
          )}
        >
          <MediaItem m={m} />
          {i === 3 && media.length > 4 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">+{media.length - 4}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MissingMedia({ platform }: { platform: PlatformId }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-center text-[11px] text-[var(--ze-danger)]">
      {SPECS[platform].name} needs {platform === "youtube" ? "a video" : "an image or video"}
    </div>
  );
}

function LinkCard({ url }: { url: string }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  return (
    <div className="overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)]">
      <div className="h-16 bg-[var(--ze-fill)]" />
      <div className="px-3 py-2 text-[11px] text-[var(--ze-muted)] uppercase">{host}</div>
    </div>
  );
}

export function PreviewGrid({
  post,
  platforms,
  author,
  previewOnly = [],
}: {
  post: ComposerPost;
  platforms: readonly PlatformId[];
  author?: PreviewAuthor;
  previewOnly?: readonly PlatformId[];
}) {
  if (!platforms.length) {
    return (
      <Notice title="Previews appear here">
        Pick one or more accounts and you'll see how the post lands on each platform: thread splits, feed cut-offs and crops.
      </Notice>
    );
  }
  return (
    // Columns, not a grid: previews have very different heights and a grid leaves holes.
    <div className="columns-1 gap-4 sm:columns-2">
      {platforms.map((p) => (
        <div key={p} className="mb-4 break-inside-avoid">
          <PostPreview post={post} platform={p} author={author} previewOnly={previewOnly.includes(p)} />
        </div>
      ))}
    </div>
  );
}
