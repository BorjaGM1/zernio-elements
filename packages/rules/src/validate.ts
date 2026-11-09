import { SPECS } from "./specs";
import { countText, extractHashtags, extractLinks, splitThread, truncateAt } from "./text";
import type {
  AdaptedPost,
  ComposerPost,
  Issue,
  PlatformId,
  ValidationResult,
} from "./types";

function textFor(post: ComposerPost, platform: PlatformId): string {
  return post.overrides?.[platform]?.content ?? post.content;
}

function titleFor(post: ComposerPost, platform: PlatformId): string | undefined {
  return post.overrides?.[platform]?.title ?? post.title;
}

function effectiveLimit(post: ComposerPost, platform: PlatformId): number {
  const spec = SPECS[platform];
  if (spec.text.captionMaxLength && post.media.length > 0) return spec.text.captionMaxLength;
  return spec.text.maxLength;
}

/** Build the per-platform rendering model used by previews and by toCreatePostBody. */
export function adapt(post: ComposerPost, platform: PlatformId): AdaptedPost {
  const spec = SPECS[platform];
  const text = textFor(post, platform);
  const limit = effectiveLimit(post, platform);
  const count = countText(text, spec.text.countMode);
  const segments =
    spec.text.supportsThreads && count > limit
      ? splitThread(text, limit, spec.text.countMode)
      : [text];
  const preview = spec.text.previewTruncateAt
    ? truncateAt(segments[0] ?? "", spec.text.previewTruncateAt)
    : { visible: segments[0] ?? "", truncated: false };

  return {
    platform,
    text,
    title: titleFor(post, platform),
    segments,
    preview,
    count,
    limit,
    hashtags: extractHashtags(text),
    links: extractLinks(text),
    media: post.media.slice(0, spec.media.maxItems),
  };
}

export function validatePlatform(post: ComposerPost, platform: PlatformId): Issue[] {
  const spec = SPECS[platform];
  const issues: Issue[] = [];
  const add = (i: Omit<Issue, "platform">) => issues.push({ platform, ...i });

  const text = textFor(post, platform);
  const title = titleFor(post, platform);
  const limit = effectiveLimit(post, platform);
  const count = countText(text, spec.text.countMode);
  const hasMedia = post.media.length > 0;

  // Text
  if (!text.trim() && (spec.text.required || !hasMedia)) {
    add({ severity: "error", code: "text_required", message: `${spec.name} needs text.` });
  }
  if (count > limit) {
    if (spec.text.supportsThreads) {
      const parts = splitThread(text, limit, spec.text.countMode);
      const n = parts.length;
      add({
        severity: "info",
        code: "text_will_be_threaded",
        message: `${count}/${limit}. Will publish as a ${n}-post thread.`,
        fix: "split-thread",
      });
      // A single word or link longer than the limit can't be split, so that post would be rejected.
      if (parts.some((p) => countText(p, spec.text.countMode) > limit)) {
        add({
          severity: "error",
          code: "text_too_long",
          message: `A single word or link is longer than ${limit} characters on ${spec.name}, so it can't fit in one post.`,
        });
      }
    } else {
      add({
        severity: "error",
        code: "text_too_long",
        message: `${count}/${limit} characters on ${spec.name}.`,
        fix: "truncate",
      });
    }
  } else if (spec.text.previewTruncateAt && count > spec.text.previewTruncateAt) {
    add({
      severity: "info",
      code: "text_truncated_in_feed",
      message: `Feed shows the first ~${spec.text.previewTruncateAt} characters, then "more".`,
    });
  }

  // Title
  if (spec.title) {
    if (!title?.trim()) {
      if (spec.title.required) {
        add({ severity: "error", code: "title_required", message: `${spec.name} needs a title.`, fix: "add-title" });
      } else if (platform === "youtube" || platform === "reddit") {
        add({
          severity: "warning",
          code: "title_missing",
          message: `No title. ${spec.name} will use the first line of the text.`,
          fix: "add-title",
        });
      }
    }
    if (title && countText(title, "graphemes") > spec.title.maxLength) {
      add({
        severity: "error",
        code: "title_too_long",
        message: `Title over ${spec.title.maxLength} characters.`,
      });
    }
  }

  // Media
  if (spec.media.required && !hasMedia) {
    add({ severity: "error", code: "media_required", message: `${spec.name} needs an image or video.` });
  }
  if (spec.media.videoOnly && hasMedia && !post.media.some((m) => m.type === "video")) {
    add({ severity: "error", code: "media_required", message: `${spec.name} needs a video.` });
  }
  if (post.media.length > spec.media.maxItems) {
    add({
      severity: "error",
      code: "too_many_media",
      message: `${spec.name} takes up to ${spec.media.maxItems} media items (${post.media.length} attached).`,
      fix: "remove-extra-media",
    });
  }
  const types = new Set(post.media.map((m) => (m.type === "gif" ? "image" : m.type)));
  if (!spec.media.allowMixed && types.size > 1) {
    add({ severity: "error", code: "mixed_media_not_allowed", message: `${spec.name} can't mix images and video.` });
  }
  for (const m of post.media) {
    if (m.type === "video" && spec.media.video && m.durationSec !== undefined) {
      if (m.durationSec > spec.media.video.maxDurationSec) {
        add({
          severity: "error",
          code: "video_too_long",
          message: `Video is ${Math.round(m.durationSec)}s, ${spec.name} max is ${spec.media.video.maxDurationSec}s.`,
        });
      }
      if (spec.media.video.minDurationSec && m.durationSec < spec.media.video.minDurationSec) {
        add({
          severity: "error",
          code: "video_too_short",
          message: `Video under ${spec.media.video.minDurationSec}s.`,
        });
      }
    }
    const range = m.type === "video" ? spec.media.video?.aspectRatio : spec.media.image?.aspectRatio;
    if (range && m.width && m.height) {
      const ratio = m.width / m.height;
      if (ratio < range.min - 0.01 || ratio > range.max + 0.01) {
        add({
          severity: "warning",
          code: "aspect_ratio_out_of_range",
          message: `Aspect ratio ${ratio.toFixed(2)} outside ${range.min}-${range.max}; ${spec.name} will crop.`,
        });
      }
    }
  }

  // Hashtags & links
  const tags = extractHashtags(text);
  if (spec.hashtags && tags.length > spec.hashtags.max) {
    add({
      severity: "warning",
      code: "too_many_hashtags",
      message: `${tags.length} hashtags, ${spec.name} uses at most ${spec.hashtags.max}.`,
      fix: "drop-hashtags",
    });
  }
  if (!spec.links.clickable && extractLinks(text).length > 0) {
    add({ severity: "warning", code: "links_not_clickable", message: `Links aren't clickable on ${spec.name}.` });
  }

  return issues;
}

export function validate(post: ComposerPost, platforms: readonly PlatformId[]): ValidationResult {
  const byPlatform: Partial<Record<PlatformId, Issue[]>> = {};
  const issues: Issue[] = [];
  for (const p of platforms) {
    const list = validatePlatform(post, p);
    byPlatform[p] = list;
    issues.push(...list);
  }
  return { valid: !issues.some((i) => i.severity === "error"), issues, byPlatform };
}

/**
 * Apply an Issue's one-click fix. Pure: returns a new post.
 * Platform-specific fixes write a per-platform override so other platforms keep the original text.
 */
export function applyFix(post: ComposerPost, issue: Issue): ComposerPost {
  const spec = SPECS[issue.platform];
  const text = textFor(post, issue.platform);
  const withOverride = (content: string): ComposerPost => ({
    ...post,
    overrides: { ...post.overrides, [issue.platform]: { ...post.overrides?.[issue.platform], content } },
  });

  switch (issue.fix) {
    case "truncate": {
      const limit = effectiveLimit(post, issue.platform);
      if (countText(text, spec.text.countMode) <= limit) return post;
      // Leave room for the ellipsis; truncateAt counts graphemes, so step down until it fits the platform's count mode.
      let max = limit - 1;
      let cut = truncateAt(text, max).visible;
      while (max > 0 && countText(`${cut}…`, spec.text.countMode) > limit) cut = truncateAt(text, (max -= 5)).visible;
      return withOverride(`${cut}…`);
    }
    case "add-title": {
      const firstLine = (text.split("\n").find((l) => l.trim()) ?? "").trim();
      const max = spec.title?.maxLength ?? 100;
      const title = truncateAt(firstLine.replace(/\s+#\S+/g, ""), max).visible;
      return { ...post, title: post.title?.trim() ? post.title : title };
    }
    case "drop-hashtags": {
      const keep = spec.hashtags?.max ?? 0;
      let seen = 0;
      const cleaned = text
        .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, (m) => (++seen <= keep ? m : ""))
        .replace(/[ \t]+$/gm, "")
        .trimEnd();
      return withOverride(cleaned);
    }
    case "remove-extra-media":
      return { ...post, media: post.media.slice(0, spec.media.maxItems) };
    default:
      // "split-thread" needs no change: toCreatePostBody already sends threadItems.
      return post;
  }
}
