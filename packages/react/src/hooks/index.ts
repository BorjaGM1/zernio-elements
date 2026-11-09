"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  applyFix,
  PLATFORM_IDS,
  toCreatePostBody,
  validate,
  validationBody,
  type ComposerPost,
  type Issue,
  type MediaInput,
  type PlatformId,
  type Schedule,
  type Target,
} from "@zernio-elements/rules";
import { useZernio } from "../provider";

/**
 * Minimal structural types, field names as in @zernio/node (SocialAccount, Post, inbox responses).
 * For the full types import from @zernio/node.
 */
export interface Account {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  profileUrl?: string;
  isActive?: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
}

export interface PostTarget {
  platform: string;
  /** Zernio may populate this as a SocialAccount; the hooks normalize it to the id. */
  accountId: string;
  status?: string;
  platformPostUrl?: string | null;
  errorMessage?: string;
  publishedAt?: string;
}

export interface Post {
  _id: string;
  title?: string;
  content?: string;
  status?: string;
  scheduledFor?: string;
  publishedAt?: string;
  createdAt?: string;
  platforms?: PostTarget[];
}

export interface Conversation {
  id: string;
  platform: string;
  accountId: string;
  accountUsername?: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  unreadCount?: number | null;
  updatedTime?: string;
}

export interface Message {
  id: string;
  direction: "incoming" | "outgoing";
  text: string;
  senderName?: string | null;
  createdAt: string;
}

const PUBLISHING = new Set<string>(PLATFORM_IDS);

/** Accounts the composer can publish to: a publishing platform, active and enabled. */
export const isPublishingAccount = (a: Account) =>
  PUBLISHING.has(a.platform) && a.isActive !== false && a.enabled !== false;

type RawTarget = Omit<PostTarget, "accountId"> & { accountId?: string | { _id?: string } };
type RawPost = Omit<Post, "platforms"> & { platforms?: RawTarget[] };

export function normalizePost(p: RawPost): Post {
  return {
    ...p,
    platforms: (p.platforms ?? []).map((t) => ({
      ...t,
      accountId: typeof t.accountId === "object" ? (t.accountId?._id ?? "") : (t.accountId ?? ""),
    })),
  };
}

/** When a post shows on the calendar: scheduled time, else when it went out, else when it was created. */
export const postDate = (p: Post) => p.scheduledFor ?? p.publishedAt ?? p.createdAt;

const TERMINAL = new Set(["published", "failed", "cancelled", "partial"]);
/** Nothing left to wait for: every platform finished, or the post isn't going out now (scheduled/draft). */
export const isSettled = (p: Post) =>
  p.status === "scheduled" ||
  p.status === "draft" ||
  ((p.platforms ?? []).length > 0 && (p.platforms ?? []).every((t) => TERMINAL.has(t.status ?? "")));

export function useAccounts() {
  const { request } = useZernio();
  return useQuery({
    queryKey: ["zernio", "accounts"],
    queryFn: () => request<{ accounts?: Account[] }>("GET", "/v1/accounts").then((r) => r.accounts ?? []),
  });
}

export interface ConnectOptions {
  platform: string;
  /** Where Zernio sends the user back after OAuth. Defaults to the current page. */
  redirectUrl?: string;
  /** Your product name on Zernio's co-branded welcome screen ("<brandName> wants to connect..."). */
  brandName?: string;
  logoUrl?: string;
  /** Hex color for the welcome screen, e.g. "#e8573c". */
  primaryColor?: string;
  /** Show the welcome screen. Defaults to true when brandName is set (Zernio rejects brandName without it). */
  welcome?: boolean;
  /** Raw OAuth data back to redirectUrl so you render your own page/account selector. */
  headless?: boolean;
  /** Use your own OAuth app (white-label consent screen). */
  oauthAppId?: string;
  /** Reconnect this account instead of adding a new one. */
  reconnectAccountId?: string;
}

export function connectQuery(o: Omit<ConnectOptions, "platform">): URLSearchParams {
  const q = new URLSearchParams();
  if (o.redirectUrl) q.set("redirect_url", o.redirectUrl);
  const welcome = o.welcome ?? (o.brandName ? true : undefined);
  if (welcome !== undefined && !o.headless) q.set("welcome", String(welcome));
  if (o.brandName && welcome && !o.headless) q.set("brandName", o.brandName.slice(0, 60));
  if (o.logoUrl && welcome && !o.headless) q.set("logoUrl", o.logoUrl);
  if (o.primaryColor && welcome && !o.headless) q.set("primaryColor", o.primaryColor);
  if (o.headless) q.set("headless", "true");
  if (o.oauthAppId) q.set("oauthAppId", o.oauthAppId);
  if (o.reconnectAccountId) q.set("reconnectAccountId", o.reconnectAccountId);
  return q;
}

/** OAuth platforms return a URL to redirect to; Telegram returns an access code to post in the channel. */
export type ConnectStart =
  | { kind: "redirect"; authUrl: string }
  | { kind: "code"; code: string; botUsername?: string; instructions: string[]; expiresAt?: string };

export function useConnect() {
  const { request } = useZernio();
  return useMutation({
    mutationFn: async ({ platform, ...o }: ConnectOptions): Promise<ConnectStart> => {
      const q = connectQuery({ redirectUrl: typeof window !== "undefined" ? window.location.href : undefined, ...o });
      const r = await request<{ authUrl?: string; code?: string; botUsername?: string; instructions?: string[]; expiresAt?: string }>(
        "GET",
        `/v1/connect/${platform}${q.size ? `?${q}` : ""}`,
      );
      if (r.authUrl) return { kind: "redirect", authUrl: r.authUrl };
      if (r.code) return { kind: "code", code: r.code, botUsername: r.botUsername, instructions: r.instructions ?? [], expiresAt: r.expiresAt };
      throw new Error("Zernio did not return a connect URL.");
    },
  });
}

/** Connect a Telegram channel by @username (or numeric id) once @LateScheduleBot is an admin there. */
export function useConnectTelegramChannel() {
  const { request } = useZernio();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chatId: string) =>
      request<{ message?: string; account?: { username?: string } }>("POST", "/v1/connect/telegram", {
        chatId: /^-?\d+$/.test(chatId.trim()) || chatId.trim().startsWith("@") ? chatId.trim() : `@${chatId.trim()}`,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zernio", "accounts"] }),
  });
}

/** Poll a Telegram access code every 3s until the bot confirms it (sent to the bot in a private chat). */
export function useTelegramConnectStatus(code: string | null) {
  const { request } = useZernio();
  const qc = useQueryClient();
  return useQuery({
    enabled: Boolean(code),
    queryKey: ["zernio", "telegram-connect", code],
    queryFn: async () => {
      const r = await request<{ status?: "pending" | "connected" | "expired"; chatTitle?: string; message?: string }>(
        "PATCH",
        `/v1/connect/telegram?code=${encodeURIComponent(code!)}`,
      );
      if (r.status === "connected") qc.invalidateQueries({ queryKey: ["zernio", "accounts"] });
      return r;
    },
    refetchInterval: (q) => (q.state.data?.status === "pending" || !q.state.data ? 3000 : false),
  });
}

export function usePosts() {
  const { request } = useZernio();
  return useQuery({
    queryKey: ["zernio", "posts"],
    queryFn: () =>
      request<{ posts?: RawPost[] }>("GET", "/v1/posts?limit=100").then((r) => (r.posts ?? []).map(normalizePost)),
  });
}

/** One post, polled every 2s until every platform has settled (published / failed). */
export function usePost(id: string | null | undefined) {
  const { request } = useZernio();
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["zernio", "post", id],
    queryFn: () => request<{ post?: RawPost }>("GET", `/v1/posts/${id}`).then((r) => (r.post ? normalizePost(r.post) : null)),
    // Stop when settled, when the post is gone (null), or after errors; otherwise poll every 2s.
    refetchInterval: (q) => (q.state.data === null || q.state.error || (q.state.data && isSettled(q.state.data)) ? false : 2000),
  });
}

/** Edit a post. Optimistically updates the posts list (e.g. the calendar while dragging) and rolls back on error. */
export function useUpdatePost() {
  const { request } = useZernio();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; scheduledFor?: string; content?: string }) =>
      request<{ post?: RawPost }>("PUT", `/v1/posts/${id}`, patch),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["zernio", "posts"] });
      const previous = qc.getQueryData<Post[]>(["zernio", "posts"]);
      qc.setQueryData<Post[]>(["zernio", "posts"], (posts) => posts?.map((p) => (p._id === id ? { ...p, ...patch } : p)));
      return { previous };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(["zernio", "posts"], ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ["zernio", "posts"] }),
  });
}

/** Same time of day, another date. */
export function moveToDay(iso: string, day: Date): string {
  const d = new Date(iso);
  const next = new Date(day);
  next.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
  return next.toISOString();
}

/** Read width/height/duration in the browser so the rules engine can validate before upload finishes. */
export async function readMediaInfo(file: File): Promise<Pick<MediaInput, "type" | "width" | "height" | "durationSec">> {
  const type: MediaInput["type"] = file.type.startsWith("video/")
    ? "video"
    : file.type === "image/gif"
      ? "gif"
      : file.type === "application/pdf"
        ? "document"
        : "image";
  if (typeof document === "undefined" || type === "document") return { type };
  const src = URL.createObjectURL(file);
  try {
    if (type === "video") {
      return await new Promise((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => resolve({ type, width: v.videoWidth, height: v.videoHeight, durationSec: v.duration });
        v.onerror = () => resolve({ type });
        v.src = src;
      });
    }
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ type, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ type });
      img.src = src;
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}

/**
 * Upload through POST /v1/media/presign: ask for a signed URL, PUT the bytes straight to storage
 * (the API key never touches the browser), then use the public URL in mediaItems.
 */
export function useMediaUpload() {
  const { request } = useZernio();
  return useMutation({
    mutationFn: async (file: File): Promise<MediaInput> => {
      const info = await readMediaInfo(file);
      const signed = await request<{ uploadUrl?: string; publicUrl?: string; mock?: boolean }>("POST", "/v1/media/presign", {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      let url = signed.publicUrl ?? "";
      if (signed.mock) {
        url = URL.createObjectURL(file);
      } else {
        if (!signed.uploadUrl || !signed.publicUrl) throw new Error("Upload URL missing from Zernio response.");
        const put = await fetch(signed.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      }
      return { url, ...info, alt: "" };
    },
  });
}

export interface PublishResult {
  post: Post;
  message?: string;
  warnings: string[];
  /** The server ran on demo fixtures: nothing was actually posted. */
  mock?: boolean;
}

/**
 * Composer state + live per-platform validation + publish.
 * Validation runs locally on every keystroke (rules engine); publish also asks Zernio's
 * POST /v1/tools/validate/post as the authoritative check.
 */
export function useComposer(initial?: Partial<ComposerPost>) {
  const { request } = useZernio();
  const qc = useQueryClient();
  const [post, setPost] = useState<ComposerPost>({ content: "", media: [], ...initial });
  const [targets, setTargets] = useState<Target[]>([]);
  const [previewOnly, setPreviewOnly] = useState<PlatformId[]>([]);

  // Publishing platforms (validated, sent to Zernio) vs. everything previewed (adds preview-only platforms).
  const platforms = useMemo(() => [...new Set(targets.map((t) => t.platform))], [targets]);
  // Stable order (X first, as in PLATFORM_IDS) so previews don't jump around as accounts are toggled.
  const previewPlatforms = useMemo(
    () => PLATFORM_IDS.filter((p) => platforms.includes(p) || previewOnly.includes(p)),
    [platforms, previewOnly],
  );
  const validation = useMemo(() => validate(post, platforms), [post, platforms]);

  const publish = useMutation({
    mutationFn: async (schedule: Schedule = { publishNow: true }): Promise<PublishResult> => {
      const body = toCreatePostBody(post, targets, schedule);
      const server = await request<{ valid?: boolean; errors?: Array<{ platform?: string; error?: string }> }>(
        "POST",
        "/v1/tools/validate/post",
        validationBody(body),
      );
      if (server.valid === false) {
        throw new Error(server.errors?.map((e) => (e.platform ? `${e.platform}: ${e.error}` : e.error)).join("\n") || "Zernio rejected the post.");
      }
      const r = await request<{ post?: RawPost; message?: string; warnings?: string[]; mock?: boolean }>("POST", "/v1/posts", body);
      if (!r.post?._id) throw new Error(r.message ?? "Zernio did not return the post.");
      return { post: normalizePost(r.post), message: r.message, warnings: r.warnings ?? [], ...(r.mock ? { mock: true } : {}) };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zernio", "posts"] }),
  });

  return {
    post,
    setContent: (content: string) => setPost((p) => ({ ...p, content })),
    setTitle: (title: string) => setPost((p) => ({ ...p, title })),
    addMedia: (m: MediaInput) => setPost((p) => ({ ...p, media: [...p.media, m] })),
    removeMedia: (url: string) => setPost((p) => ({ ...p, media: p.media.filter((m) => m.url !== url) })),
    setOverride: (platform: PlatformId, content: string | undefined) =>
      setPost((p) => ({ ...p, overrides: { ...p.overrides, [platform]: { ...p.overrides?.[platform], content } } })),
    clearOverride: (platform: PlatformId) =>
      setPost((p) => {
        const { [platform]: _, ...rest } = p.overrides ?? {};
        return { ...p, overrides: rest };
      }),
    applyFix: (issue: Issue) => setPost((p) => applyFix(p, issue)),
    targets,
    toggleTarget: (t: Target) =>
      setTargets((ts) => (ts.some((x) => x.accountId === t.accountId) ? ts.filter((x) => x.accountId !== t.accountId) : [...ts, t])),
    setTargets,
    platforms,
    /** Platforms shown in previews without an account: never validated as blocking, never published. */
    previewOnly,
    togglePreview: (p: PlatformId) => setPreviewOnly((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p])),
    previewPlatforms,
    validation,
    publish,
    reset: () => setPost({ content: "", media: [] }),
  };
}

export type ComposerController = ReturnType<typeof useComposer>;

type RawConversation = Omit<Conversation, "id" | "accountId"> & { id?: string; accountId?: string };

export function useInbox() {
  const { request } = useZernio();
  return useQuery({
    queryKey: ["zernio", "inbox"],
    queryFn: () =>
      request<{ data?: RawConversation[] }>("GET", "/v1/inbox/conversations?limit=50").then((r) =>
        (r.data ?? []).filter((c): c is Conversation => Boolean(c.id && c.accountId)),
      ),
  });
}

type RawMessage = { id?: string; direction?: "incoming" | "outgoing"; message?: string; senderName?: string | null; createdAt?: string };

/** A conversation thread. Zernio needs the conversation's accountId on every call. */
export function useMessages(conversation: Pick<Conversation, "id" | "accountId"> | null | undefined) {
  const { request } = useZernio();
  const qc = useQueryClient();
  const id = conversation?.id;
  const accountId = conversation?.accountId;
  const query = useQuery({
    enabled: Boolean(id && accountId),
    queryKey: ["zernio", "messages", id],
    queryFn: () =>
      request<{ messages?: RawMessage[] }>(
        "GET",
        `/v1/inbox/conversations/${encodeURIComponent(id!)}/messages?accountId=${encodeURIComponent(accountId!)}&sortOrder=asc`,
      ).then((r) =>
        (r.messages ?? [])
          .map((m, i): Message => ({
            id: m.id ?? String(i),
            direction: m.direction ?? "incoming",
            text: m.message ?? "",
            senderName: m.senderName,
            createdAt: m.createdAt ?? "",
          }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      ),
  });
  const send = useMutation({
    mutationFn: (message: string) =>
      request("POST", `/v1/inbox/conversations/${encodeURIComponent(id!)}/messages`, { accountId, message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["zernio", "messages", id] });
      qc.invalidateQueries({ queryKey: ["zernio", "inbox"] });
    },
  });
  return { ...query, send };
}

export interface AnalyticsSummary {
  totals: { impressions: number; engagement: number; clicks: number; posts: number };
  daily: Array<{ date: string; impressions: number; engagement: number }>;
}

type DailyMetrics = {
  dailyData?: Array<{ date?: string; postCount?: number; metrics?: Record<string, number | undefined> }>;
  totals?: Record<string, number | undefined>;
};

const engagementOf = (m: Record<string, number | undefined> = {}) =>
  (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);

/** Map GET /v1/analytics/daily-metrics into a fixed-length daily series (missing days are zero). */
export function summarizeDailyMetrics(r: DailyMetrics, days: number, today = new Date()): AnalyticsSummary {
  const byDate = new Map((r.dailyData ?? []).map((d) => [(d.date ?? "").slice(0, 10), d]));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const m = byDate.get(date)?.metrics;
    return { date, impressions: m?.impressions ?? 0, engagement: engagementOf(m) };
  });
  const t = r.totals ?? {};
  return {
    totals: {
      impressions: t.impressions ?? daily.reduce((n, d) => n + d.impressions, 0),
      engagement: t.engagement ?? engagementOf(t),
      clicks: t.clicks ?? 0,
      posts: t.postCount ?? (r.dailyData ?? []).reduce((n, d) => n + (d.postCount ?? 0), 0),
    },
    daily,
  };
}

export function useAnalytics({ days = 14 }: { days?: number } = {}) {
  const { request } = useZernio();
  return useQuery({
    queryKey: ["zernio", "analytics", days],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - (days - 1) * 86_400_000);
      const q = new URLSearchParams({ fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) });
      const r = await request<DailyMetrics>("GET", `/v1/analytics/daily-metrics?${q}`);
      return summarizeDailyMetrics(r, days, to);
    },
  });
}
