/**
 * In-memory fixtures so the demo runs on Vercel with no API key.
 * Every response mirrors the real Zernio shape (field names from @zernio/node 0.2.1548 types:
 * AccountsListResponse, PostsListResponse, PostCreateResponse, ListInboxConversationsResponse,
 * GetInboxConversationMessagesResponse, GetDailyMetricsResponse, GetMediaPresignedUrlResponse).
 */
type Json = Record<string, unknown>;

const PROFILE = "mock_profile";
const now = Date.now();
const iso = (offsetH: number) => new Date(now + offsetH * 3_600_000).toISOString();

const account = (id: string, platform: string, username: string, displayName: string): Json => ({
  _id: id,
  platform,
  profileId: PROFILE,
  username,
  displayName,
  profilePicture: null,
  profileUrl: `https://example.com/${username}`,
  isActive: true,
  enabled: true,
  needsReconnection: false,
});

const accounts: Json[] = [
  account("acc_x", "twitter", "brand", "Brand"),
  account("acc_bs", "bluesky", "brand.bsky.social", "Brand"),
  account("acc_th", "threads", "brand", "Brand"),
  account("acc_li", "linkedin", "brand", "Brand Inc."),
  account("acc_ig", "instagram", "brand", "Brand"),
  account("acc_yt", "youtube", "brand", "Brand"),
  // Not a publishing target: the kit must ignore it in the composer.
  account("acc_wa", "whatsapp", "+34600000000", "Brand"),
];

const target = (accountId: string, platform: string, status: string, extra: Json = {}): Json => ({
  platform,
  accountId,
  status,
  ...extra,
});

const posts: Json[] = [
  {
    _id: "post_1",
    profileId: PROFILE,
    content: "Summer availability is open. Book direct and skip the fees.",
    status: "scheduled",
    scheduledFor: iso(20),
    timezone: "Europe/Madrid",
    platforms: [target("acc_ig", "instagram", "pending"), target("acc_li", "linkedin", "pending")],
    createdAt: iso(-30),
  },
  {
    _id: "post_2",
    profileId: PROFILE,
    content: "Behind the scenes: how we turn a flat around between guests in under 2 hours.",
    status: "published",
    publishedAt: iso(-26),
    platforms: [
      target("acc_th", "threads", "published", {
        platformPostUrl: "https://example.com/threads/post_2",
        publishedAt: iso(-26),
      }),
    ],
    createdAt: iso(-27),
  },
  {
    _id: "post_3",
    profileId: PROFILE,
    content: "New listing in Cartagena. Sea views, 2 bedrooms.",
    status: "scheduled",
    scheduledFor: iso(50),
    timezone: "Europe/Madrid",
    platforms: [target("acc_x", "twitter", "pending"), target("acc_bs", "bluesky", "pending")],
    createdAt: iso(-2),
  },
];

const conversations: Json[] = [
  {
    id: "conv_1",
    platform: "instagram",
    accountId: "acc_ig",
    accountUsername: "brand",
    participantId: "u1",
    participantName: "Lucía M.",
    participantPicture: null,
    lastMessage: "Is the Cartagena flat free the second week of August?",
    updatedTime: iso(-1),
    status: "active",
    unreadCount: 1,
  },
  {
    id: "conv_2",
    platform: "twitter",
    accountId: "acc_x",
    accountUsername: "brand",
    participantId: "u2",
    participantName: "Tom Reyes",
    participantPicture: null,
    lastMessage: "Thanks, see you then.",
    updatedTime: iso(-5),
    status: "active",
    unreadCount: 0,
  },
  {
    id: "conv_3",
    platform: "bluesky",
    accountId: "acc_bs",
    accountUsername: "brand.bsky.social",
    participantId: "u3",
    participantName: "Marta Gil",
    participantPicture: null,
    lastMessage: "Do you allow dogs?",
    updatedTime: iso(-28),
    status: "active",
    unreadCount: 0,
  },
];

const msg = (id: string, conv: string, direction: "incoming" | "outgoing", message: string, h: number): Json => {
  const c = conversations.find((x) => x.id === conv) ?? {};
  return {
    id,
    conversationId: conv,
    accountId: c.accountId,
    platform: c.platform,
    message,
    senderName: direction === "incoming" ? c.participantName : "You",
    direction,
    createdAt: iso(h),
    attachments: [],
  };
};

const messages: Record<string, Json[]> = {
  conv_1: [
    msg("m1", "conv_1", "incoming", "Hi! Is the Cartagena flat free the second week of August?", -1.2),
  ],
  conv_2: [
    msg("m2", "conv_2", "incoming", "Can we check in before 3pm on Friday?", -6),
    msg("m3", "conv_2", "outgoing", "Yes, from 1pm. The code arrives by SMS that morning.", -5.5),
    msg("m4", "conv_2", "incoming", "Thanks, see you then.", -5),
  ],
  conv_3: [msg("m5", "conv_3", "incoming", "Do you allow dogs?", -28)],
};

function dailyMetrics(): Json {
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const impressions = 2400 + Math.round(Math.sin(i / 2) * 800 + i * 90);
    const likes = 120 + Math.round(Math.cos(i / 3) * 30 + i * 5);
    const comments = 18 + (i % 4) * 3;
    const shares = 9 + (i % 3) * 2;
    const clicks = 40 + Math.round(Math.sin(i) * 12 + i * 2);
    return {
      date: new Date(now - (13 - i) * 86_400_000).toISOString().slice(0, 10),
      postCount: i % 3 === 0 ? 2 : 1,
      platforms: { instagram: 1, linkedin: i % 2 },
      metrics: { impressions, reach: Math.round(impressions * 0.72), likes, comments, shares, saves: 6, clicks, views: 0 },
    };
  });
  const sum = (k: string) =>
    dailyData.reduce((n, d) => n + ((d.metrics as Record<string, number>)[k] ?? 0), 0);
  const totals = {
    postCount: dailyData.reduce((n, d) => n + d.postCount, 0),
    impressions: sum("impressions"),
    reach: sum("reach"),
    likes: sum("likes"),
    comments: sum("comments"),
    shares: sum("shares"),
    saves: sum("saves"),
    clicks: sum("clicks"),
    views: 0,
    engagement: sum("likes") + sum("comments") + sum("shares") + sum("saves"),
  };
  return {
    dailyData,
    // Shares that add up to the totals, so anything built from these numbers is internally consistent.
    platformBreakdown: [
      { platform: "instagram", postCount: Math.round(totals.postCount * 0.6), impressions: Math.round(totals.impressions * 0.6), likes: Math.round(totals.likes * 0.7) },
      { platform: "linkedin", postCount: totals.postCount - Math.round(totals.postCount * 0.6), impressions: totals.impressions - Math.round(totals.impressions * 0.6), likes: totals.likes - Math.round(totals.likes * 0.7) },
    ],
    totals,
  };
}

function createPost(body: Json): Json {
  const publishNow = body.publishNow === true;
  const id = `post_${Date.now().toString(36)}`;
  const platforms = ((body.platforms as Json[] | undefined) ?? []).map((p) =>
    target(String(p.accountId), String(p.platform), publishNow ? "published" : "pending", {
      ...(p.customContent ? { customContent: p.customContent } : {}),
      ...(p.platformSpecificData ? { platformSpecificData: p.platformSpecificData } : {}),
      // No platformPostUrl: nothing was posted, so there is no real link to show.
      ...(publishNow ? { publishedAt: new Date().toISOString() } : {}),
    }),
  );
  return {
    _id: id,
    profileId: PROFILE,
    title: body.title,
    content: body.content,
    mediaItems: body.mediaItems ?? [],
    platforms,
    status: body.isDraft ? "draft" : publishNow ? "published" : "scheduled",
    ...(body.scheduledFor ? { scheduledFor: body.scheduledFor } : {}),
    ...(publishNow ? { publishedAt: new Date().toISOString() } : {}),
    timezone: body.timezone ?? "UTC",
    createdAt: new Date().toISOString(),
  };
}

export async function mockResponse(method: string, path: string, body: unknown, query?: URLSearchParams): Promise<Response> {
  const json = (data: unknown, status = 200) => Response.json(data, { status });
  const b = (body ?? {}) as Json;

  if (method === "GET" && path === "/v1/accounts") return json({ accounts, hasAnalyticsAccess: true });

  if (method === "GET" && path === "/v1/posts") {
    return json({ posts, pagination: { page: 1, limit: 50, total: posts.length, pages: 1, nextCursor: null } });
  }
  if (method === "POST" && path === "/v1/posts") {
    const post = createPost(b);
    posts.unshift(post);
    posts.length = Math.min(posts.length, 50); // module state on a public endpoint: keep it bounded
    return json({ message: b.publishNow ? "Demo mode: nothing was posted." : "Demo mode: nothing was scheduled.", post, mock: true }, 201);
  }
  const postMatch = path.match(/^\/v1\/posts\/([^/]+)$/);
  if (postMatch) {
    const i = posts.findIndex((p) => p._id === postMatch[1]);
    if (i < 0) return json({ error: "Post not found" }, 404);
    if (method === "GET") return json({ post: posts[i] });
    if (method === "PUT") {
      posts[i] = { ...posts[i], ...b, updatedAt: new Date().toISOString() };
      return json({ message: "Post updated", post: posts[i] });
    }
    if (method === "DELETE") {
      posts.splice(i, 1);
      return json({ message: "Post deleted" });
    }
  }

  if (method === "GET" && path === "/v1/connect/telegram") {
    return json({
      code: "ZRN-DEMO42",
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      expiresIn: 900,
      botUsername: "LateScheduleBot",
      instructions: [
        "1. Add @LateScheduleBot as an administrator in your channel/group",
        "2. Open a private chat with @LateScheduleBot",
        "3. If your channel has a public username, send: ZRN-DEMO42 @yourchannel",
        "4. Wait for confirmation",
      ],
    });
  }
  if (method === "PATCH" && path === "/v1/connect/telegram") return json({ status: "pending", expiresIn: 900 });
  if (method === "POST" && path === "/v1/connect/telegram") {
    return json({ message: "Telegram connected", account: { _id: "acc_tg", platform: "telegram", username: String(b.chatId ?? "").replace(/^@/, ""), isActive: true } });
  }
  if (method === "GET" && path.startsWith("/v1/connect/")) {
    return json({ authUrl: "about:blank#mock-oauth", state: "mock_state" });
  }

  if (method === "POST" && path === "/v1/media/presign") {
    // No storage behind the mock: the client keeps the file as a local object URL.
    return json({ uploadUrl: "", publicUrl: "", key: `mock/${String(b.filename ?? "file")}`, expiresIn: 3600, mock: true });
  }

  if (method === "GET" && path === "/v1/inbox/conversations") {
    return json({
      data: conversations,
      pagination: { hasMore: false, nextCursor: null },
      meta: { accountsQueried: 3, accountsFailed: 0, failedAccounts: [] },
    });
  }
  const m = path.match(/^\/v1\/inbox\/conversations\/([^/]+)\/messages$/);
  if (m) {
    const id = m[1] ?? "";
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return json({ error: "Conversation not found" }, 404);
    if (method === "POST") {
      if (!b.accountId) return json({ error: "accountId is required" }, 400);
      const text = String(b.message ?? "");
      const sent = msg(`m${Date.now()}`, id, "outgoing", text, 0);
      (messages[id] ??= []).push(sent);
      conv.lastMessage = text;
      conv.updatedTime = sent.createdAt;
      return json({ success: true, data: { messageId: sent.id, conversationId: id } });
    }
    if (!query?.get("accountId")) return json({ error: "accountId is required" }, 400);
    return json({ status: "success", messages: messages[id] ?? [], pagination: { hasMore: false, nextCursor: null }, sortOrderApplied: "asc" });
  }

  if (method === "GET" && path === "/v1/analytics/daily-metrics") return json(dailyMetrics());
  if (method === "GET" && path.startsWith("/v1/analytics")) {
    return json({ overview: { totalPosts: posts.length, publishedPosts: 1, scheduledPosts: 2, lastSync: iso(-1) }, posts: [], hasAnalyticsAccess: true });
  }

  if (method === "POST" && path === "/v1/tools/validate/post") return json({ valid: true, message: "Post is valid", warnings: [] });
  if (method === "POST" && path.startsWith("/v1/tools/validate")) return json({ valid: true, warnings: [] });

  return json({ error: "Not mocked", path }, 404);
}
