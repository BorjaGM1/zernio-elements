/**
 * Platform ids exactly as Zernio names them in POST /v1/posts and POST /v1/tools/validate/post.
 * These are the 15 publishing platforms. Zernio's other connectors (ads, sms, phone, shopify...)
 * are not publishing targets and have no preview.
 */
export const PLATFORM_IDS = [
  "twitter",
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "bluesky",
  "threads",
  "reddit",
  "pinterest",
  "telegram",
  "snapchat",
  "googlebusiness",
  "discord",
  "slack",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];

export type CountMode =
  /** One unit per user-perceived character (Intl.Segmenter). */
  | "graphemes"
  /** UTF-16 code units (JS string length). What Zernio's validator counts, verified by drift.test.ts. */
  | "chars"
  /**
   * X: the stricter of X's own weighting (URLs = 23, CJK and emoji = 2) and Zernio's count
   * (UTF-16 length, URLs = 23), so a post never fits here but fails at X or at Zernio.
   */
  | "twitter";

export interface Range {
  min: number;
  max: number;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  text: {
    maxLength: number;
    countMode: CountMode;
    /** Text is mandatory even when media is attached. */
    required: boolean;
    /** Where the feed cuts the text with "...more" / "see more". Undefined = shows everything. */
    previewTruncateAt?: number;
    /** Platform supports native threads through Zernio platformSpecificData.threadItems. */
    supportsThreads: boolean;
    /** Lower limit that applies to the caption when media is attached (Telegram). */
    captionMaxLength?: number;
  };
  title?: {
    required: boolean;
    maxLength: number;
  };
  media: {
    required: boolean;
    maxItems: number;
    allowMixed: boolean;
    /** Only video is accepted (YouTube). */
    videoOnly?: boolean;
    image?: { aspectRatio?: Range };
    video?: { maxDurationSec: number; minDurationSec?: number; aspectRatio?: Range };
  };
  hashtags?: { max: number };
  links: {
    /** Links in the text are clickable. */
    clickable: boolean;
  };
  /**
   * false until every number above has been checked against Zernio's per-platform schema docs
   * (https://docs.zernio.com/platforms) and POST /v1/tools/validate/post-length.
   */
  verified: boolean;
  notes?: string[];
}

export type MediaType = "image" | "video" | "gif" | "document";

export interface MediaInput {
  url: string;
  type: MediaType;
  width?: number;
  height?: number;
  durationSec?: number;
  alt?: string;
}

/** What the composer holds. One post, optionally overridden per platform. */
export interface ComposerPost {
  content: string;
  title?: string;
  media: MediaInput[];
  overrides?: Partial<Record<PlatformId, { content?: string; title?: string }>>;
}

export type Severity = "error" | "warning" | "info";

export interface Issue {
  platform: PlatformId;
  severity: Severity;
  code: IssueCode;
  message: string;
  /** Optional auto-fix the composer can offer with one click. */
  fix?: "split-thread" | "truncate" | "add-title" | "remove-extra-media" | "drop-hashtags";
}

export type IssueCode =
  | "text_required"
  | "text_too_long"
  | "text_will_be_threaded"
  | "text_truncated_in_feed"
  | "title_required"
  | "title_missing"
  | "title_too_long"
  | "media_required"
  | "too_many_media"
  | "mixed_media_not_allowed"
  | "video_too_long"
  | "video_too_short"
  | "aspect_ratio_out_of_range"
  | "too_many_hashtags"
  | "links_not_clickable"
  | "unverified_spec";

export interface ValidationResult {
  valid: boolean;
  issues: Issue[];
  byPlatform: Partial<Record<PlatformId, Issue[]>>;
}

export interface AdaptedPost {
  platform: PlatformId;
  /** Final text for this platform (override or base). */
  text: string;
  title?: string;
  /** One item per post in the thread. Length 1 when not threaded. */
  segments: string[];
  /** What the feed shows before "...more". */
  preview: { visible: string; truncated: boolean };
  count: number;
  limit: number;
  hashtags: string[];
  links: string[];
  media: MediaInput[];
}
