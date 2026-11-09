/**
 * The MCP App contract, shared by apps/mcp (server) and packages/widgets (UI).
 *
 * preview_post builds the exact POST /v1/posts body and a hash of it. The widget renders that payload
 * and sends it back unchanged with publish_post; the server refuses anything whose hash doesn't match.
 * What the person approves is byte-for-byte what gets published.
 */
import { SPECS } from "./specs";
import { adapt, validatePlatform } from "./validate";
import { toCreatePostBody, type CreatePostBody, type Schedule } from "./zernio";
import { PLATFORM_IDS, type AdaptedPost, type ComposerPost, type Issue, type MediaType, type PlatformId } from "./types";

export const RESOURCE_URIS = {
  preview: "ui://zernio-elements/preview-post.html",
  analytics: "ui://zernio-elements/analytics.html",
  accounts: "ui://zernio-elements/accounts.html",
  view: "ui://zernio-elements/render-view.html",
} as const;

export const TOOL_NAMES = {
  preview: "preview_post",
  publish: "publish_post",
  analytics: "get_analytics",
  accounts: "check_accounts",
  view: "render_view",
} as const;

/** A connected account the tenant can publish to. */
export interface AccountRef {
  platform: PlatformId;
  accountId: string;
  username?: string;
  /** Profile picture URL from Zernio (SocialAccount.profilePicture), shown in previews. */
  avatarUrl?: string;
}

/** preview_post arguments. Also what the widget sends back after an inline edit. */
export interface PreviewPostInput {
  content: string;
  platforms: PlatformId[];
  title?: string;
  media?: Array<{ url: string; type: MediaType; alt?: string; width?: number; height?: number; durationSec?: number }>;
  /** Per-platform text/title that replaces the base (inline edits in the widget). */
  overrides?: Partial<Record<PlatformId, { content?: string; title?: string }>>;
  /** ISO date-time. Omit to publish now. */
  scheduledFor?: string;
  timezone?: string;
}

/**
 * ready: will be published. blocked: has an error (e.g. TikTok needs a video).
 * no_account: previewed only, nothing connected for that platform.
 */
export type TargetState = "ready" | "blocked" | "no_account";

export interface PreviewTarget {
  platform: PlatformId;
  name: string;
  account: AccountRef | null;
  state: TargetState;
  issues: Issue[];
  preview: AdaptedPost;
}

/** preview_post structuredContent. */
export interface PreviewResult {
  input: PreviewPostInput;
  post: ComposerPost;
  targets: PreviewTarget[];
  /** Exactly what publish_post will send to POST /v1/posts. Null when nothing is publishable. */
  payload: CreatePostBody | null;
  payloadHash: string | null;
  publishable: PlatformId[];
}

/** publish_post arguments: the payload from PreviewResult, unchanged. */
export interface PublishPostInput {
  payload: CreatePostBody;
  payloadHash: string;
}

export interface PublishedTarget {
  platform: string;
  accountId: string;
  status: string;
  url: string | null;
  error: string | null;
}

/** publish_post structuredContent. */
export interface PublishResult {
  postId: string;
  status: string;
  message?: string;
  payloadHash: string;
  platforms: PublishedTarget[];
  warnings: string[];
}

/** JSON with sorted keys and no undefined values: same bytes on the server, in the widget and after a round trip. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : sortKeys(x)));
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** sha256 (hex) of the canonical JSON. Web Crypto: works in Node 20+, edge runtimes and browsers. */
export async function hashPayload(payload: CreatePostBody): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPayload({ payload, payloadHash }: PublishPostInput): Promise<boolean> {
  return (await hashPayload(payload)) === payloadHash;
}

export const isPlatformId = (p: string): p is PlatformId => (PLATFORM_IDS as readonly string[]).includes(p);

/**
 * Turn preview_post arguments + the tenant's accounts into the preview the widget renders and the
 * payload publish_post will send. Uses the first connected account per platform.
 */
export async function buildPreview(input: PreviewPostInput, accounts: readonly AccountRef[]): Promise<PreviewResult> {
  const platforms = [...new Set(input.platforms)].filter(isPlatformId);
  const post: ComposerPost = {
    content: input.content,
    ...(input.title ? { title: input.title } : {}),
    media: (input.media ?? []).map((m) => ({ ...m })),
    ...(input.overrides && Object.keys(input.overrides).length ? { overrides: input.overrides } : {}),
  };

  const targets: PreviewTarget[] = platforms.map((platform) => {
    const account = accounts.find((a) => a.platform === platform) ?? null;
    const issues = validatePlatform(post, platform);
    const state: TargetState = !account ? "no_account" : issues.some((i) => i.severity === "error") ? "blocked" : "ready";
    return { platform, name: SPECS[platform].name, account, state, issues, preview: adapt(post, platform) };
  });

  const ready = targets.filter((t) => t.state === "ready");
  const schedule: Schedule = input.scheduledFor
    ? { scheduledFor: input.scheduledFor, ...(input.timezone ? { timezone: input.timezone } : {}) }
    : { publishNow: true };
  const payload = ready.length
    ? toCreatePostBody(
        post,
        ready.map((t) => ({ platform: t.platform, accountId: t.account!.accountId })),
        schedule,
      )
    : null;
  // Normalise through JSON so the payload is exactly what crosses the wire (no undefined keys).
  const wire = payload ? (JSON.parse(JSON.stringify(payload)) as CreatePostBody) : null;

  return {
    input,
    post,
    targets,
    payload: wire,
    payloadHash: wire ? await hashPayload(wire) : null,
    publishable: ready.map((t) => t.platform),
  };
}
