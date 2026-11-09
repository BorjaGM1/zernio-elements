import type { PlatformId, PlatformSpec } from "./types";

/**
 * Per-platform rules.
 *
 * Checked on 2026-11-09 against Zernio's platform docs (https://docs.zernio.com/platforms/<id>,
 * .../<id>/media) and the OpenAPI spec (https://zernio.com/openapi.json). verified: true means every
 * hard limit below matches those docs; text limits are also checked against the live
 * POST /v1/tools/validate/post-length by drift.test.ts whenever ZERNIO_API_KEY is set.
 *
 * Text is counted like Zernio's validator: UTF-16 length ("chars"); X also applies its own weighting.
 *
 * previewTruncateAt values are feed-UI approximations (Zernio does not document them); they only
 * drive previews and "info" notes, never errors.
 */
export const SPECS: Record<PlatformId, PlatformSpec> = {
  twitter: {
    id: "twitter",
    name: "X",
    text: { maxLength: 280, countMode: "twitter", required: false, supportsThreads: true },
    media: {
      required: false,
      maxItems: 4,
      allowMixed: false,
      // X sets video length per account; Zernio only enforces 512 MB, so no hard duration cap here.
      video: { maxDurationSec: 14400, minDurationSec: 0.5 },
    },
    links: { clickable: true },
    verified: true,
    notes: ["X Premium accounts: 25000 chars (Zernio resolves this per accountId).", "4 images, or 1 GIF, or 1 video."],
  },
  bluesky: {
    id: "bluesky",
    name: "Bluesky",
    text: { maxLength: 300, countMode: "chars", required: false, supportsThreads: true },
    media: { required: false, maxItems: 4, allowMixed: false, video: { maxDurationSec: 60 } },
    links: { clickable: true },
    verified: true,
    notes: ["Up to 4 images or a single MP4 video (50 MB)."],
  },
  threads: {
    id: "threads",
    name: "Threads",
    text: { maxLength: 500, countMode: "chars", required: false, supportsThreads: true },
    media: { required: false, maxItems: 10, allowMixed: false, video: { maxDurationSec: 300 } },
    hashtags: { max: 1 },
    links: { clickable: true },
    verified: true,
    notes: ["One topic tag per post (platformSpecificData.topic_tag).", "Carousels: up to 10 images, no video."],
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    text: {
      maxLength: 3000,
      countMode: "chars",
      required: false,
      supportsThreads: false,
      previewTruncateAt: 210,
    },
    media: { required: false, maxItems: 20, allowMixed: false, video: { maxDurationSec: 600, minDurationSec: 3 } },
    links: { clickable: true },
    verified: true,
    notes: ["Video up to 10 min on personal profiles, 30 min on organization pages."],
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    text: {
      maxLength: 2200,
      countMode: "chars",
      required: false,
      supportsThreads: false,
      previewTruncateAt: 125,
    },
    media: {
      required: true,
      maxItems: 20,
      allowMixed: true,
      image: { aspectRatio: { min: 0.5625, max: 1.91 } },
      video: { maxDurationSec: 900, minDurationSec: 3 },
    },
    hashtags: { max: 30 },
    links: { clickable: false },
    verified: true,
    notes: ["Carousels: up to 20 images and videos mixed. Stories: video up to 60s."],
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    text: {
      maxLength: 63206,
      countMode: "chars",
      required: false,
      supportsThreads: false,
      previewTruncateAt: 480,
    },
    media: { required: false, maxItems: 10, allowMixed: false, video: { maxDurationSec: 14400 } },
    links: { clickable: true },
    verified: true,
    notes: ["Images and videos cannot be mixed. Reels up to 60s, Stories up to 120s."],
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    text: {
      maxLength: 2200,
      countMode: "chars",
      required: false,
      supportsThreads: false,
      previewTruncateAt: 100,
    },
    media: {
      required: true,
      maxItems: 35,
      allowMixed: false,
      video: { maxDurationSec: 600, minDurationSec: 3, aspectRatio: { min: 0.5, max: 0.6 } },
    },
    links: { clickable: false },
    verified: true,
    notes: [
      "One video or up to 35 photos, never both. Photo titles are cut to 90 characters.",
      "Requires tiktokSettings (privacy_level, allow_comment, consent flags) in platformSpecificData.",
    ],
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    text: { maxLength: 5000, countMode: "chars", required: false, supportsThreads: false, previewTruncateAt: 100 },
    // Zernio defaults a missing title to the first line of content, so it's a warning, not an error.
    title: { required: false, maxLength: 100 },
    media: { required: true, maxItems: 1, allowMixed: false, videoOnly: true, video: { maxDurationSec: 43200, minDurationSec: 1 } },
    links: { clickable: true },
    verified: true,
    notes: [
      "Title goes in platformSpecificData.title (falls back to first line of content, then \"Untitled Video\").",
      "12h max for verified channels, 15 min otherwise.",
      "Vertical video up to 3 min publishes as a Short.",
    ],
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    text: { maxLength: 800, countMode: "chars", required: false, supportsThreads: false },
    title: { required: false, maxLength: 100 },
    media: {
      required: true,
      maxItems: 1,
      allowMixed: false,
      image: { aspectRatio: { min: 0.476, max: 1.0 } },
      video: { maxDurationSec: 900, minDurationSec: 4 },
    },
    links: { clickable: true },
    verified: true,
    notes: ["2:3 is the recommended pin ratio. Send boardId in platformSpecificData, or the pin lands on the first board."],
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    text: { maxLength: 40000, countMode: "chars", required: false, supportsThreads: false },
    title: { required: false, maxLength: 300 },
    media: { required: false, maxItems: 20, allowMixed: false },
    links: { clickable: true },
    verified: false,
    notes: [
      "Zernio's docs report Reddit currently blocks third-party posting.",
      "Needs a subreddit (or the account default). Title defaults to the first line.",
    ],
  },
  telegram: {
    id: "telegram",
    name: "Telegram",
    text: {
      maxLength: 4096,
      countMode: "chars",
      required: false,
      supportsThreads: false,
      captionMaxLength: 1024,
    },
    media: { required: false, maxItems: 10, allowMixed: true },
    links: { clickable: true },
    verified: true,
  },
  snapchat: {
    id: "snapchat",
    name: "Snapchat",
    text: { maxLength: 160, countMode: "chars", required: false, supportsThreads: false },
    media: { required: true, maxItems: 1, allowMixed: false, video: { maxDurationSec: 60, minDurationSec: 5 } },
    links: { clickable: false },
    verified: false,
    notes: ["Closed beta on Zernio. 160 chars applies to Spotlight; saved stories use a 45-char title."],
  },
  googlebusiness: {
    id: "googlebusiness",
    name: "Google Business",
    text: { maxLength: 1500, countMode: "chars", required: true, supportsThreads: false },
    media: { required: false, maxItems: 1, allowMixed: false },
    links: { clickable: false },
    verified: false,
    notes: ["Links in text are not clickable; use a call-to-action button instead."],
  },
  discord: {
    id: "discord",
    name: "Discord",
    text: { maxLength: 2000, countMode: "chars", required: false, supportsThreads: false },
    media: { required: false, maxItems: 10, allowMixed: true },
    links: { clickable: true },
    verified: false,
    notes: ["Requires platformSpecificData.channelId (and forumThreadName on forum channels)."],
  },
  slack: {
    id: "slack",
    name: "Slack",
    text: { maxLength: 40000, countMode: "chars", required: false, supportsThreads: false },
    media: { required: false, maxItems: 10, allowMixed: true },
    links: { clickable: true },
    verified: false,
  },
};

export function getSpec(platform: PlatformId): PlatformSpec {
  return SPECS[platform];
}
