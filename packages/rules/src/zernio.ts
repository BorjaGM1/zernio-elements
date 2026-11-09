import { adapt } from "./validate";
import { SPECS } from "./specs";
import type { ComposerPost, PlatformId } from "./types";

export interface Target {
  platform: PlatformId;
  accountId: string;
  /** Extra platformSpecificData, e.g. { boardId } for Pinterest or { subreddit } for Reddit. */
  data?: Record<string, unknown>;
}

export interface Schedule {
  publishNow?: boolean;
  scheduledFor?: string;
  timezone?: string;
  isDraft?: boolean;
}

/**
 * Shape of POST /v1/posts (subset). Kept structural on purpose so this package has zero deps.
 * See CreatePostData in @zernio/node for the full type.
 */
export interface CreatePostBody {
  title?: string;
  content?: string;
  mediaItems?: Array<{ url: string; type?: string; altText?: string }>;
  platforms: Array<{
    platform: string;
    accountId: string;
    customContent?: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
  publishNow?: boolean;
  scheduledFor?: string;
  timezone?: string;
  isDraft?: boolean;
}

/**
 * Turn the composer state into a Zernio POST /v1/posts body.
 * - per-platform text goes into customContent
 * - long text on X / Threads / Bluesky becomes platformSpecificData.threadItems
 * - titles go where each platform expects them
 */
export function toCreatePostBody(post: ComposerPost, targets: Target[], schedule: Schedule = {}): CreatePostBody {
  // Zernio's MediaItem calls it altText; omit the key when there is none.
  const mediaItems = post.media.map((m) => ({ url: m.url, type: m.type, ...(m.alt ? { altText: m.alt } : {}) }));
  return {
    title: post.title,
    content: post.content,
    mediaItems,
    platforms: targets.map((t) => {
      const a = adapt(post, t.platform);
      const spec = SPECS[t.platform];
      const psd: Record<string, unknown> = { ...(t.data ?? {}) };

      if (a.segments.length > 1 && spec.text.supportsThreads) {
        psd.threadItems = a.segments.map((content, i) => ({
          content,
          ...(i === 0 && mediaItems.length ? { mediaItems } : {}),
        }));
      }
      if (spec.title && a.title) psd.title = a.title;

      // Never customContent on a thread: Zernio then publishes it as one post and drops threadItems
      // (verified live on Bluesky). validationBody() handles Zernio's length check instead.
      const threaded = Array.isArray(psd.threadItems);
      const customContent = !threaded && a.text !== post.content ? a.text : undefined;

      return {
        platform: t.platform,
        accountId: t.accountId,
        ...(customContent !== undefined ? { customContent } : {}),
        ...(Object.keys(psd).length ? { platformSpecificData: psd } : {}),
      };
    }),
    ...schedule,
  };
}

/**
 * The body for POST /v1/tools/validate/post. Zernio's validator checks each platform's text against the
 * limit even when threadItems are set (a 348-char Bluesky thread is rejected), so thread targets are
 * validated with their root segment as customContent. Only the validation request changes: the body
 * sent to POST /v1/posts stays exactly the approved payload.
 */
export function validationBody(body: CreatePostBody): Pick<CreatePostBody, "content" | "mediaItems" | "platforms"> {
  return {
    content: body.content,
    mediaItems: body.mediaItems,
    platforms: body.platforms.map((p) => {
      const items = p.platformSpecificData?.threadItems as Array<{ content?: string }> | undefined;
      return Array.isArray(items) && items[0]?.content && p.customContent === undefined ? { ...p, customContent: items[0].content } : p;
    }),
  };
}
