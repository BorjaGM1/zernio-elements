import { TOOL_NAMES, canonicalJson, type PlatformId } from "@zernio-elements/rules";
import type { HostActions } from "../bridge";
import { isPreviewResult, isPublishResult, type PreviewPostInput, type PreviewResult, type PublishPostInput, type PublishResult } from "../types";
import type { Tone } from "../shared";
import { listJoin } from "../shared";

type Target = PreviewResult["targets"][number];

/** preview_post arguments after an inline edit: the original input with this platform's text overridden. */
export function editArgs(result: PreviewResult, platform: PlatformId, content: string): PreviewPostInput {
  return {
    ...result.input,
    overrides: { ...result.input.overrides, [platform]: { ...result.input.overrides?.[platform], content } },
  };
}

/** publish_post arguments: the preview's payload and hash, untouched. Null when nothing is publishable. */
export function publishArgs(result: PreviewResult): PublishPostInput | null {
  if (!result.payload || !result.payloadHash) return null;
  return { payload: result.payload, payloadHash: result.payloadHash };
}

/** Re-runs preview_post through the host with this platform's edit and returns the new PreviewResult. */
export async function runEdit(actions: Pick<HostActions, "callTool">, result: PreviewResult, platform: PlatformId, content: string): Promise<PreviewResult> {
  const next = await actions.callTool(TOOL_NAMES.preview, editArgs(result, platform, content) as unknown as Record<string, unknown>);
  if (!isPreviewResult(next)) throw new Error("preview_post returned something unexpected.");
  return next;
}

/** Sends the approved payload to publish_post through the host and returns the PublishResult. */
export async function runPublish(actions: Pick<HostActions, "callTool">, result: PreviewResult): Promise<PublishResult> {
  const args = publishArgs(result);
  if (!args) throw new Error("Nothing to publish.");
  const out = await actions.callTool(TOOL_NAMES.publish, args as unknown as Record<string, unknown>);
  if (!isPublishResult(out)) throw new Error("publish_post returned something unexpected.");
  return out;
}

/** First error message, phrased as "TikTok needs an image or video". */
export function blockReason(t: Target): string {
  const issue = t.issues.find((i) => i.severity === "error") ?? t.issues[0];
  if (!issue) return `${t.name} needs attention`;
  const msg = issue.message.replace(/\.\s*$/, "");
  return msg.toLowerCase().startsWith(t.name.toLowerCase()) ? msg : `${t.name}: ${msg.charAt(0).toLowerCase()}${msg.slice(1)}`;
}

/** One line: "Ready for Bluesky and LinkedIn · X, Instagram preview only · TikTok needs a video". */
export function summary(result: PreviewResult): string {
  const ready = result.targets.filter((t) => t.state === "ready").map((t) => t.name);
  const previewOnly = result.targets.filter((t) => t.state === "no_account").map((t) => t.name);
  const blocked = result.targets.filter((t) => t.state === "blocked");
  const parts: string[] = [];
  if (ready.length) parts.push(`${result.payload?.scheduledFor ? "Scheduling" : "Ready"} for ${listJoin(ready)}`);
  if (previewOnly.length) parts.push(`${previewOnly.join(", ")} preview only`);
  for (const t of blocked) parts.push(blockReason(t));
  if (!ready.length) parts.unshift("Nothing to publish yet");
  return parts.join(" · ");
}

const STATE_RANK: Record<Target["state"], number> = { ready: 0, blocked: 1, no_account: 2 };

/** Ready first, then blocked, then preview-only; request order kept within each group. */
export const orderTargets = (targets: readonly Target[]): Target[] =>
  targets.map((t, i) => ({ t, i })).sort((a, b) => STATE_RANK[a.t.state] - STATE_RANK[b.t.state] || a.i - b.i).map((x) => x.t);

/** First ready target, else the first one. */
export const defaultTarget = (targets: readonly Target[]): PlatformId | undefined => (targets.find((t) => t.state === "ready") ?? targets[0])?.platform;

export type Outcome = "published" | "scheduled" | "failed";

/** How publish_post went for one platform, once there is a PublishResult. */
export function outcomeOf(r: PublishResult | undefined, platform: string): Outcome | undefined {
  const p = r?.platforms.find((x) => x.platform === platform);
  if (!p) return undefined;
  if (p.error || /fail|error/i.test(p.status)) return "failed";
  return /schedul/i.test(p.status) ? "scheduled" : "published";
}

/**
 * One author for every preview: the first connected account in the result, else a neutral brand.
 * A target with its own account shows that handle; other targets get the short handle (no domain),
 * so an X preview never shows "@name.bsky.social".
 */
export function authorFor(result: PreviewResult, target?: Pick<Target, "account">): { name: string; handle: string; avatar?: string } {
  const username = result.targets.find((t) => t.account?.username)?.account?.username?.replace(/^@/, "");
  if (!username) return { name: "Your brand", handle: "yourbrand" };
  const base = username.split(".")[0]!;
  const name = base.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || username;
  const avatar = result.targets.find((t) => t.account?.avatarUrl)?.account?.avatarUrl;
  if (!target) return { name, handle: username, ...(avatar ? { avatar } : {}) };
  const own = target.account?.username?.replace(/^@/, "");
  return { name, handle: own ?? base, ...(avatar ? { avatar } : {}) };
}

export function stateOf(t: Target, outcome?: Outcome): { label: string; tone: Tone } {
  if (outcome === "published") return { label: "Published", tone: "success" };
  if (outcome === "scheduled") return { label: "Scheduled", tone: "success" };
  if (outcome === "failed") return { label: "Failed", tone: "danger" };
  if (t.state === "ready") return { label: "Will publish", tone: "success" };
  if (t.state === "blocked") return { label: "Needs attention", tone: "danger" };
  return { label: "Preview only", tone: "neutral" };
}

export function stateDetail(t: Target, outcome?: Outcome): string {
  const as = t.account?.username ? `@${t.account.username.replace(/^@/, "")}` : `your ${t.name} account`;
  if (outcome === "published") return `Published as ${as}`;
  if (outcome === "scheduled") return `Scheduled as ${as}`;
  if (outcome === "failed") return `Couldn't publish as ${as}`;
  if (t.state === "ready") return t.account?.username ? `Publishing as ${as}` : `Publishing to ${as}`;
  if (t.state === "blocked") return "Left out of Publish until this is fixed";
  return `No ${t.name} account connected. Shown for reference, never published`;
}

/** Text the edit box starts with: what this platform will actually get. */
export const editableText = (t: Target) => t.preview.text;

export function publishLabel(result: PreviewResult): string {
  const n = result.publishable.length;
  return `${result.payload?.scheduledFor ? "Schedule" : "Publish"} ${n}`;
}

export const shortHash = (h: string | null | undefined) => (h ? h.slice(0, 12) : "");

/** Pretty-printed canonical JSON (sorted keys, same as the hashed bytes), made readable. */
export const prettyCanonical = (value: unknown) => JSON.stringify(JSON.parse(canonicalJson(value)), null, 2);
