import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import {
  buildPreview,
  hashPayload,
  isPlatformId,
  PLATFORM_IDS,
  RESOURCE_URIS,
  SPECS,
  TOOL_NAMES,
  type AccountRef,
  type CreatePostBody,
  type PlatformId,
  type PreviewPostInput,
  type PreviewResult,
  type PublishResult,
  validationBody,
} from "@zernio-elements/rules";
import { z } from "zod";
import type { Config } from "./config";
import { accountIdOf, isPublishingAccount, isSettled, summarizeDailyMetrics, type Account, type DailyMetrics, type RawPost } from "./helpers";
import { accountsHtml, analyticsHtml, previewPostHtml, renderViewHtml } from "./widgets";
import { catalogPrompt, parseAndValidate, validateCatalogSpec } from "@zernio-elements/catalog/server";
import { mockResponse } from "@zernio-elements/server";
import { errorText, zernioClient, type ZernioClient } from "./zernio";

/**
 * Origins the widgets may load from (img/script/style/font/media). Post media is any https URL the
 * person gave, so images come from arbitrary hosts; the named ones are the usual sources.
 */
const WIDGET_CSP = {
  resourceDomains: [
    "https://images.unsplash.com",
    "https://media.zernio.com",
    "https://*.zernio.com",
    // Profile pictures Zernio returns for connected accounts.
    "https://cdn.bsky.app",
    "https://pbs.twimg.com",
    "https://media.licdn.com",
    "https://*.cdninstagram.com",
    "https://*.fbcdn.net",
    "https://*.tiktokcdn.com",
    "https://yt3.ggpht.com",
  ],
};

/** Platforms check_accounts reports on even when nothing is connected. */
const CORE_PLATFORMS: PlatformId[] = ["twitter", "instagram", "linkedin", "tiktok", "bluesky", "threads", "facebook", "youtube"];

const text = (s: string) => [{ type: "text" as const, text: s }];
const fail = (message: string, extra: Record<string, unknown> = {}): CallToolResult => ({
  isError: true,
  content: text(message),
  structuredContent: { error: message, ...extra },
});

const platformEnum = z.enum(PLATFORM_IDS);

const previewInput = z.object({
  content: z.string().describe("Base text of the post. Per-platform adaptation (threads, truncation) is automatic."),
  platforms: z.array(platformEnum).min(1).describe("Platforms to preview. Ones without a connected account are preview-only."),
  title: z.string().optional().describe("Title, for platforms that use one (YouTube, Reddit, Pinterest)."),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["image", "video", "gif", "document"]),
        alt: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        durationSec: z.number().optional(),
      }),
    )
    .optional()
    .describe("Public https URLs of images/videos to attach."),
  overrides: z
    .partialRecord(platformEnum, z.object({ content: z.string().optional(), title: z.string().optional() }))
    .optional()
    .describe("Per-platform text/title replacing the base (inline edits)."),
  scheduledFor: z.string().datetime({ offset: true }).optional().describe("ISO date-time to schedule. Omit to publish now."),
  timezone: z.string().optional().describe("IANA timezone for scheduledFor, e.g. Europe/Madrid."),
});

// The payload is accepted as an opaque record on purpose: a zod object schema would strip or reorder
// keys, and publish_post must send exactly what it received. Its shape is checked by hand below.
const publishInput = z.object({
  payload: z.record(z.string(), z.unknown()).describe("structuredContent.payload from preview_post, unchanged."),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/).describe("structuredContent.payloadHash from preview_post."),
});

export function createMcpServer(config: Config, zernio: ZernioClient = zernioClient(config)): McpServer {
  const server = new McpServer({ name: "zernio-elements", version: "0.0.1" });

  async function listAccounts(): Promise<{ accounts: Account[] } | { error: string }> {
    const r = await zernio.request<{ accounts?: Account[] }>("GET", `/v1/accounts?profileId=${encodeURIComponent(config.profileId)}`);
    if (!r.ok) return { error: `Could not list accounts: ${errorText(r.data, r.status)}` };
    return { accounts: r.data.accounts ?? [] };
  }

  // Widgets show a "Mock data" tag when the server runs on fixtures (no ZERNIO_API_KEY).
  const mockFlag = config.mock ? { mock: true } : {};

  const accountRefs = (accounts: Account[]): AccountRef[] =>
    accounts.filter(isPublishingAccount).flatMap((a) =>
      isPlatformId(a.platform)
        ? [{ platform: a.platform, accountId: a._id, ...(a.username ? { username: a.username } : {}), ...(a.profilePicture ? { avatarUrl: a.profilePicture } : {}) }]
        : [],
    );

  // --- Widgets -------------------------------------------------------------------------------------
  const widgets: Array<[string, string, string]> = [
    ["Post preview and approval", RESOURCE_URIS.preview, previewPostHtml],
    ["Analytics", RESOURCE_URIS.analytics, analyticsHtml],
    ["Accounts", RESOURCE_URIS.accounts, accountsHtml],
    ["Custom view", RESOURCE_URIS.view, renderViewHtml],
  ];
  for (const [name, uri, html] of widgets) {
    registerAppResource(server, name, uri, { description: `${name} widget`, _meta: { ui: { csp: WIDGET_CSP } } }, async () => ({
      contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui: { csp: WIDGET_CSP, prefersBorder: true } } }],
    }));
  }

  // --- preview_post --------------------------------------------------------------------------------
  registerAppTool(
    server,
    TOOL_NAMES.preview,
    {
      title: "Preview a post",
      description:
        "Preview a social post on each platform before anything is published. ALWAYS call this before publishing: " +
        "it adapts the text per platform (X/Bluesky/Threads threads, limits), flags blocking issues (e.g. TikTok needs a video) " +
        "and shows the person an approval widget. Platforms without a connected account are preview-only and are never published. " +
        "This tool never publishes; publishing happens only when the person clicks Publish in the widget. " +
        "Call it directly: it already reports which platforms have a connected account, so there is no need to call check_accounts first. " +
        "Pass one shared text in content; use overrides only when a platform truly needs different wording.",
      inputSchema: previewInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: RESOURCE_URIS.preview } },
    },
    async (args): Promise<CallToolResult> => {
      const listed = await listAccounts();
      if ("error" in listed) return fail(listed.error);
      const result = await buildPreview(args as PreviewPostInput, accountRefs(listed.accounts));
      return { content: text(previewText(result)), structuredContent: { ...(result as unknown as Record<string, unknown>), ...mockFlag } };
    },
  );

  // --- publish_post --------------------------------------------------------------------------------
  registerAppTool(
    server,
    TOOL_NAMES.publish,
    {
      title: "Publish an approved post",
      description:
        "Publish the exact payload the person approved in the preview_post widget. Called by the widget when the person clicks Publish" +
        (config.publishModelVisible
          ? "; only call it after the person explicitly approved the preview."
          : ", not by the model. If you can see this tool, do not call it: ask the person to click Publish in the preview widget.") +
        " Requires payload and payloadHash from preview_post, unchanged; any change is refused.",
      inputSchema: publishInput,
      // destructive: publishing is public and can't be undone, so hosts that prompt for permission will ask.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URIS.preview,
          // App-only: the model can't call it; only the person's click in the widget can.
          visibility: config.publishModelVisible ? ["model", "app"] : ["app"],
        },
      },
    },
    async ({ payload: received, payloadHash }): Promise<CallToolResult> => {
      if (!config.allowPublish) {
        return fail("Publishing is disabled on this server (MCP_ALLOW_PUBLISH is not set to 1). Nothing was published.");
      }
      const payload = received as unknown as CreatePostBody;
      if ((await hashPayload(payload)) !== payloadHash) {
        return fail("Refused: the payload does not match the approved preview (hash mismatch). Nothing was published. Run preview_post again.");
      }
      const platforms = Array.isArray(payload.platforms) ? payload.platforms : [];
      if (!platforms.length || platforms.some((p) => typeof p?.accountId !== "string" || typeof p?.platform !== "string")) {
        return fail("Refused: the payload has no valid platforms. Nothing was published.");
      }

      const listed = await listAccounts();
      if ("error" in listed) return fail(listed.error);
      const owned = new Set(listed.accounts.map((a) => a._id));
      const foreign = platforms.map((p) => p.accountId).filter((id) => !owned.has(id));
      if (foreign.length) {
        return fail(`Refused: account(s) ${foreign.join(", ")} do not belong to this profile. Nothing was published.`, { accountIds: foreign });
      }

      const check = await zernio.request<{ valid?: boolean; errors?: Array<{ platform?: string; error?: string; message?: string }> }>(
        "POST",
        "/v1/tools/validate/post",
        // Thread targets are validated with their root segment; the POST below still gets the exact payload.
        validationBody(payload),
      );
      if (!check.ok || check.data.valid === false) {
        const errors = check.data.errors ?? [];
        const detail = errors.length
          ? errors.map((e) => (e.platform ? `${e.platform}: ${e.error ?? e.message}` : (e.error ?? e.message))).join("\n")
          : errorText(check.data, check.status);
        return fail(`Zernio rejected the post, nothing was published:\n${detail}`, { errors });
      }

      // Exactly the received object, serialised once: nothing added, nothing removed.
      const created = await zernio.request<{ post?: RawPost; message?: string; warnings?: string[] }>("POST", "/v1/posts", JSON.stringify(received));
      const postId = created.data.post?._id;
      if (!created.ok || !postId) return fail(`Zernio did not create the post: ${errorText(created.data, created.status)}`);

      let post: RawPost = created.data.post ?? {};
      const deadline = Date.now() + config.pollTimeoutMs;
      while (!isSettled(post) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, config.pollIntervalMs));
        const r = await zernio.request<{ post?: RawPost }>("GET", `/v1/posts/${encodeURIComponent(postId)}`);
        if (r.ok && r.data.post) post = r.data.post;
      }

      const result: PublishResult = {
        postId,
        status: post.status ?? "unknown",
        ...(created.data.message ? { message: created.data.message } : {}),
        payloadHash,
        platforms: (post.platforms ?? []).map((t) => ({
          platform: t.platform ?? "",
          accountId: accountIdOf(t),
          status: t.status ?? "unknown",
          url: t.platformPostUrl ?? null,
          error: t.errorMessage ?? t.error ?? null,
        })),
        warnings: created.data.warnings ?? [],
      };
      return { content: text(publishText(result)), structuredContent: { ...(result as unknown as Record<string, unknown>), ...mockFlag } };
    },
  );

  // --- get_analytics -------------------------------------------------------------------------------
  registerAppTool(
    server,
    TOOL_NAMES.analytics,
    {
      title: "Get analytics",
      description: "Summarise how posts performed over the last N days (impressions, engagement, clicks, posts), with a daily series and per-platform breakdown.",
      inputSchema: z.object({ days: z.number().int().min(7).max(90).default(7).describe("Days to cover, 7 to 90. Default 7.") }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: RESOURCE_URIS.analytics } },
    },
    async ({ days }): Promise<CallToolResult> => {
      const to = new Date();
      const from = new Date(to.getTime() - (days - 1) * 86_400_000);
      const q = new URLSearchParams({ profileId: config.profileId, fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) });
      const r = await zernio.request<DailyMetrics>("GET", `/v1/analytics/daily-metrics?${q}`);
      if (r.status === 402) {
        const message = "Analytics is not available on this Zernio plan (the analytics add-on is required).";
        return { content: text(message), structuredContent: { days, available: false, reason: "analytics_addon_required", message } };
      }
      if (!r.ok) return fail(`Could not load analytics: ${errorText(r.data, r.status)}`);
      let data = r.data;
      let sample = false;
      const empty = (d: DailyMetrics) => !(d.dailyData ?? []).length && !d.totals?.impressions && !d.totals?.postCount;
      if (empty(data) && config.sampleAnalyticsWhenEmpty) {
        // Real data always wins; sample numbers are labelled as such in the widget and in this text.
        const fixture = (await (await mockResponse("GET", "/v1/analytics/daily-metrics", undefined)).json()) as DailyMetrics;
        // Keep the sample internally consistent with the requested window: totals are the sum of the days shown.
        const fromDay = from.toISOString().slice(0, 10);
        const dailyData = (fixture.dailyData ?? []).filter((d) => (d.date ?? "") >= fromDay);
        const sum = (k: string) => dailyData.reduce((n, d) => n + (d.metrics?.[k] ?? 0), 0);
        const totals = {
          postCount: dailyData.reduce((n, d) => n + (d.postCount ?? 0), 0),
          impressions: sum("impressions"),
          clicks: sum("clicks"),
          engagement: sum("likes") + sum("comments") + sum("shares") + sum("saves"),
        };
        const share = (fixture.totals?.impressions ?? 0) ? totals.impressions / (fixture.totals?.impressions ?? 1) : 0;
        const platformBreakdown = (fixture.platformBreakdown ?? []).map((p) => ({
          ...p,
          ...(typeof p.postCount === "number" ? { postCount: Math.round(p.postCount * share) } : {}),
          ...(typeof p.impressions === "number" ? { impressions: Math.round(p.impressions * share) } : {}),
          ...(typeof p.likes === "number" ? { likes: Math.round(p.likes * share) } : {}),
        }));
        data = { dailyData, totals, platformBreakdown };
        sample = true;
      }
      const summary = summarizeDailyMetrics(data, days, to);
      const platforms = data.platformBreakdown ?? [];
      const structured = { days, available: true, sample, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), ...summary, platforms };
      const t = summary.totals;
      const lines = [
        ...(sample ? ["SAMPLE DATA: this profile has no recorded activity in this period yet, so these numbers are illustrative, not real. Say so to the person."] : []),
        `Last ${days} days: ${t.posts} posts, ${t.impressions} impressions, ${t.engagement} engagements, ${t.clicks} clicks.`,
        `Daily (date impressions/engagement): ${summary.daily.map((d) => `${d.date} ${d.impressions}/${d.engagement}`).join(", ")}`,
        ...platforms.map((p) => `- ${String(p.platform)}: ${Object.entries(p).filter(([k]) => k !== "platform").map(([k, v]) => `${k} ${String(v)}`).join(", ")}`),
      ];
      return { content: text(lines.join("\n")), structuredContent: { ...structured, ...mockFlag } };
    },
  );

  // --- check_accounts ------------------------------------------------------------------------------
  registerAppTool(
    server,
    TOOL_NAMES.accounts,
    {
      title: "Check accounts",
      description:
        "List the connected social accounts with their health, and connect/reconnect links for disconnected or missing platforms. " +
        "Only call this when the person asks about their accounts or connections, or a publish failed because of an account; not before previewing a post.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: RESOURCE_URIS.accounts } },
    },
    async (): Promise<CallToolResult> => {
      const listed = await listAccounts();
      if ("error" in listed) return fail(listed.error);
      const accounts = listed.accounts.map((a) => ({
        accountId: a._id,
        platform: a.platform,
        name: isPlatformId(a.platform) ? SPECS[a.platform].name : a.platform,
        username: a.username ?? null,
        displayName: a.displayName ?? null,
        isActive: a.isActive !== false,
        needsReconnection: a.needsReconnection === true,
        healthy: a.isActive !== false && a.enabled !== false && a.needsReconnection !== true,
        connectUrl: null as string | null,
        note: null as string | null,
      }));

      const connectLink = async (platform: string, reconnectAccountId?: string): Promise<{ url: string | null; note: string | null }> => {
        if (platform === "twitter") return { url: null, note: "X needs a payment method on the Zernio account before it can be connected." };
        const q = new URLSearchParams({ profileId: config.profileId, redirect_url: "https://zernio.com" });
        if (reconnectAccountId) q.set("reconnectAccountId", reconnectAccountId);
        const r = await zernio.request<{ authUrl?: string }>("GET", `/v1/connect/${encodeURIComponent(platform)}?${q}`);
        return r.ok && r.data.authUrl ? { url: r.data.authUrl, note: null } : { url: null, note: `No connect link: ${errorText(r.data, r.status)}` };
      };

      await Promise.all(
        accounts
          .filter((a) => !a.healthy)
          .map(async (a) => {
            const l = await connectLink(a.platform, a.accountId);
            a.connectUrl = l.url;
            a.note = l.note;
          }),
      );
      const connected = new Set(accounts.filter((a) => a.isActive).map((a) => a.platform));
      const missing = await Promise.all(
        CORE_PLATFORMS.filter((p) => !connected.has(p)).map(async (platform) => {
          const l = await connectLink(platform);
          return { platform, name: SPECS[platform].name, connectUrl: l.url, note: l.note };
        }),
      );

      const lines = [
        accounts.length ? "Connected accounts:" : "No accounts connected.",
        ...accounts.map(
          (a) =>
            `- ${a.name}${a.username ? ` @${a.username}` : ""}: ${a.healthy ? "healthy" : a.needsReconnection ? "needs reconnection" : "inactive"}` +
            (a.connectUrl ? ` (reconnect: ${a.connectUrl})` : "") +
            (a.note ? ` (${a.note})` : ""),
        ),
        ...(missing.length ? ["Not connected:", ...missing.map((m) => `- ${m.name}: ${m.connectUrl ? `connect at ${m.connectUrl}` : (m.note ?? "no link")}`)] : []),
      ];
      return { content: text(lines.join("\n")), structuredContent: { profileId: config.profileId, accounts, missing, ...mockFlag } };
    },
  );

  // --- render_view ---------------------------------------------------------------------------------
  // Generative UI with only tested components: the model writes a json-render spec against our catalog;
  // the server validates every element and prop before the widget renders anything.
  registerAppTool(
    server,
    TOOL_NAMES.view,
    {
      title: "Render a custom view",
      description:
        "Compose a custom read-only view (report, comparison, checklist) from Zernio Elements components and show it to the person. " +
        "Use it when they ask for a custom view of their social data. Pass the view as `spec`: the JSONL patch lines described below " +
        "(or one JSON object with root and elements). Invalid specs are rejected with the list of errors; fix them and call again.\n\n" +
        catalogPrompt({
          rules: [
            "Use only numbers and facts from earlier tool results in this conversation (get_analytics, check_accounts, preview_post) or given by the person; never invent figures.",
            "If a figure comes from sample data, say so in a Callout.",
          ],
        }),
      inputSchema: z.object({
        title: z.string().max(120).optional().describe("Optional title shown above the view."),
        spec: z.union([z.string().max(60_000), z.record(z.string(), z.unknown())]).describe("JSONL patch lines (string) or a spec object."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: RESOURCE_URIS.view } },
    },
    async ({ title, spec }): Promise<CallToolResult> => {
      const check = typeof spec === "string" ? parseAndValidate(spec) : validateCatalogSpec(spec);
      if (!check.ok) {
        return {
          isError: true,
          content: text(`The view was rejected by the catalog:\n- ${check.errors.join("\n- ")}`),
          structuredContent: { error: "Invalid view spec", errors: check.errors },
        };
      }
      const count = Object.keys(check.spec.elements).length;
      return {
        content: text(`Rendered a view with ${count} components${title ? `: ${title}` : ""}. Every component and prop was validated against the Zernio Elements catalog.`),
        structuredContent: { ...(title ? { title } : {}), spec: check.spec as unknown as Record<string, unknown> },
      };
    },
  );

  return server;
}

function previewText(r: PreviewResult): string {
  const label = { ready: "ready to publish", blocked: "blocked", no_account: "preview only (no connected account)" } as const;
  const lines = r.targets.map((t) => {
    const errors = t.issues.filter((i) => i.severity === "error");
    const warnings = t.issues.filter((i) => i.severity !== "error");
    const shape = t.preview.segments.length > 1 ? `thread of ${t.preview.segments.length} posts` : `${t.preview.count} chars`;
    return [
      `- ${t.name}: ${label[t.state]}${t.account?.username ? ` as @${t.account.username}` : ""}, ${shape}.`,
      ...errors.map((i) => `    error: ${i.message}`),
      ...warnings.map((i) => `    ${i.severity}: ${i.message}`),
    ].join("\n");
  });
  const footer = r.payload
    ? `Publishable: ${r.publishable.join(", ")}. Nothing has been published. Publishing needs the person's approval: they click Publish in the preview widget.`
    : "Nothing is publishable yet (no connected account is ready). Nothing has been published.";
  return [`Preview for ${r.targets.length} platform(s):`, ...lines, footer].join("\n");
}

function publishText(r: PublishResult): string {
  return [
    `Post ${r.postId}: ${r.status}.`,
    ...r.platforms.map((p) => `- ${p.platform}: ${p.status}${p.url ? ` ${p.url}` : ""}${p.error ? ` (${p.error})` : ""}`),
    ...r.warnings.map((w) => `warning: ${w}`),
  ].join("\n");
}
