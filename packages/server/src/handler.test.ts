import { afterEach, describe, expect, it, vi } from "vitest";
import { createZernioHandler } from "./index";

const req = (method: string, path: string, body?: unknown) =>
  new Request(`https://app.test/api/zernio${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });

afterEach(() => vi.restoreAllMocks());

describe("createZernioHandler", () => {
  it("rejects endpoints outside the allowlist", async () => {
    const h = createZernioHandler({ resolveTenant: () => ({ profileId: "p1" }) });
    const res = await h.GET(req("GET", "/v1/api-keys"));
    expect(res.status).toBe(403);
  });

  it("rejects when no tenant", async () => {
    const h = createZernioHandler({ resolveTenant: () => null });
    expect((await h.GET(req("GET", "/v1/accounts"))).status).toBe(401);
  });

  it("serves fixtures in mock mode", async () => {
    const h = createZernioHandler({ resolveTenant: () => ({ profileId: "p1" }) });
    const data = (await (await h.GET(req("GET", "/v1/accounts"))).json()) as { accounts: unknown[] };
    expect(data.accounts.length).toBeGreaterThan(0);
  });

  it("forces profileId on scoped list endpoints and injects the key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ posts: [] }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    await h.GET(req("GET", "/v1/posts?profileId=someone_else&limit=5"));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://zernio.com/api/v1/posts?profileId=p1&limit=5");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk_test");
  });

  it("blocks posting to accounts from another profile", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ accounts: [{ _id: "mine" }] }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    const res = await h.POST(req("POST", "/v1/posts", { content: "x", platforms: [{ platform: "twitter", accountId: "theirs" }] }));
    expect(res.status).toBe(403);
  });

  it("blocks reading another profile's inbox thread via the accountId query", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ accounts: [{ _id: "mine" }] }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    const res = await h.GET(req("GET", "/v1/inbox/conversations/c1/messages?accountId=theirs"));
    expect(res.status).toBe(403);
  });

  it("blocks replying from another profile's account (top-level body.accountId)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ accounts: [{ _id: "mine" }] }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    const res = await h.POST(req("POST", "/v1/inbox/conversations/c1/messages", { accountId: "theirs", message: "hi" }));
    expect(res.status).toBe(403);
  });

  it("hides posts that belong to another profile", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ post: { _id: "x", profileId: "p2" } }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    expect((await h.DELETE(req("DELETE", "/v1/posts/x"))).status).toBe(404);
    expect(fetchMock.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });

  it("accepts an account connected after the ownership cache was filled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(Response.json({ accounts: [{ _id: "a1" }] }));
    fetchMock.mockResolvedValueOnce(Response.json({ post: { _id: "p" } }));
    fetchMock.mockResolvedValueOnce(Response.json({ accounts: [{ _id: "a1" }, { _id: "a2" }] }));
    fetchMock.mockResolvedValueOnce(Response.json({ post: { _id: "q" } }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    const body = (id: string) => ({ content: "x", platforms: [{ platform: "twitter", accountId: id }] });
    expect((await h.POST(req("POST", "/v1/posts", body("a1")))).status).toBe(200);
    expect((await h.POST(req("POST", "/v1/posts", body("a2")))).status).toBe(200);
  });

  it("mock fixtures use Zernio's real field names", async () => {
    const h = createZernioHandler({ resolveTenant: () => ({ profileId: "p1" }) });
    const inbox = (await (await h.GET(req("GET", "/v1/inbox/conversations"))).json()) as { data: Array<Record<string, unknown>> };
    expect(inbox.data[0]).toHaveProperty("id");
    expect(inbox.data[0]).toHaveProperty("updatedTime");
    expect(inbox.data[0]).toHaveProperty("unreadCount");
    const c = inbox.data[0]!;
    expect((await h.GET(req("GET", `/v1/inbox/conversations/${c.id}/messages`))).status).toBe(400);
    const thread = (await (await h.GET(req("GET", `/v1/inbox/conversations/${c.id}/messages?accountId=${c.accountId}`))).json()) as {
      messages: Array<Record<string, unknown>>;
    };
    expect(thread.messages[0]).toHaveProperty("message");
    const created = (await (await h.POST(req("POST", "/v1/posts", { content: "x", publishNow: true, platforms: [{ platform: "twitter", accountId: "acc_x" }] }))).json()) as {
      post: { _id: string; platforms: Array<{ platformPostUrl?: string }> };
    };
    // Demo publishes say so and carry no fake link.
    expect(created.post.platforms[0]?.platformPostUrl).toBeUndefined();
    expect((created as unknown as { mock?: boolean }).mock).toBe(true);
  });

  it("allows polling the Telegram access code, and nothing else under PATCH /v1/connect", async () => {
    const h = createZernioHandler({ resolveTenant: () => ({ profileId: "p1" }) });
    const ok = (await (await h.PATCH(req("PATCH", "/v1/connect/telegram?code=ZRN-1"))).json()) as { status: string };
    expect(ok.status).toBe("pending");
    expect((await h.PATCH(req("PATCH", "/v1/connect/twitter"))).status).toBe(403);
  });

  it("forces the tenant's profileId into the Telegram connect body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "ok" }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    await h.POST(req("POST", "/v1/connect/telegram", { chatId: "@mychannel", profileId: "someone_else" }));
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({ chatId: "@mychannel", profileId: "p1" });
  });

  it("strips profile-targeting keys from the post body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(Response.json({ accounts: [{ _id: "mine" }] }));
    fetchMock.mockResolvedValueOnce(Response.json({ post: { _id: "p" } }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    await h.POST(req("POST", "/v1/posts", { content: "x", profileId: "p2", queuedFromProfile: "p2", platforms: [{ platform: "twitter", accountId: "mine" }] }));
    const sent = JSON.parse(String(fetchMock.mock.calls[1]![1]?.body));
    expect(sent).not.toHaveProperty("profileId");
    expect(sent).not.toHaveProperty("queuedFromProfile");
  });

  it("does not cache a failed account lookup", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(Response.json({ error: "boom" }, { status: 502 }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: "boom" }, { status: 502 }));
    fetchMock.mockResolvedValueOnce(Response.json({ accounts: [{ _id: "mine" }] }));
    fetchMock.mockResolvedValueOnce(Response.json({ post: { _id: "p" } }));
    const h = createZernioHandler({ apiKey: "sk_test", mock: false, resolveTenant: () => ({ profileId: "p1" }) });
    const body = { content: "x", platforms: [{ platform: "twitter", accountId: "mine" }] };
    expect((await h.POST(req("POST", "/v1/posts", body))).status).toBe(403);
    expect((await h.POST(req("POST", "/v1/posts", body))).status).toBe(200);
  });
});
