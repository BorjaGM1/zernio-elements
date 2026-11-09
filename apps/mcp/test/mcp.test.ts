import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { canonicalJson, RESOURCE_URIS, TOOL_NAMES, validationBody, type PreviewResult, type PublishResult } from "@zernio-elements/rules";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../lib/config";
import { createHandler } from "../lib/handler";

const TOKEN = "s3cret-token-for-tests";
const BASE = "https://zernio.com/api";

const config = (over: Partial<Config> = {}): Config => ({
  token: TOKEN,
  apiKey: "zernio_test_key",
  profileId: "prof_1",
  sampleAnalyticsWhenEmpty: false,
  mock: false,
  allowPublish: true,
  publishModelVisible: false,
  baseUrl: BASE,
  pollTimeoutMs: 500,
  pollIntervalMs: 1,
  ...over,
});

const LONG =
  "The autumn tasting menu starts Thursday. Seven courses, all from producers within 80 km of the kitchen, paired with natural wines from our cellar.\n\nExpect wild mushrooms, line-caught hake, and the last txakoli before the harvest closes. Only 24 seats a night. Reservations open now, and the first two weeks always go fast, so book early if you can.";

interface Call {
  method: string;
  url: string;
  body: string | undefined;
}

/** Fake Zernio behind global fetch. Records every call. */
function fakeZernio(opts: { valid?: boolean } = {}) {
  const calls: Call[] = [];
  let created: Record<string, unknown> | undefined;
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ method, url, body });
    const path = new URL(url).pathname.replace(/^\/api/, "");
    if (method === "GET" && path === "/v1/accounts") {
      return Response.json({
        accounts: [
          { _id: "acc_bs", platform: "bluesky", username: "demo.bsky.social", isActive: true, enabled: true },
          { _id: "acc_li", platform: "linkedin", username: "brand", isActive: true, enabled: true },
          { _id: "acc_wa", platform: "whatsapp", isActive: true, enabled: true },
        ],
      });
    }
    if (method === "POST" && path === "/v1/tools/validate/post") {
      return opts.valid === false
        ? Response.json({ valid: false, errors: [{ platform: "bluesky", error: "Text exceeds 300 characters" }] })
        : Response.json({ valid: true, message: "Post is valid" });
    }
    if (method === "POST" && path === "/v1/posts") {
      const b = JSON.parse(body!) as { platforms: Array<{ platform: string; accountId: string }> };
      created = {
        _id: "post_new",
        status: "publishing",
        platforms: b.platforms.map((p) => ({ platform: p.platform, accountId: { _id: p.accountId }, status: "pending" })),
      };
      return Response.json({ message: "Post created", post: created }, { status: 201 });
    }
    if (method === "GET" && path === "/v1/posts/post_new") {
      const platforms = (created!.platforms as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        status: "published",
        platformPostUrl: `https://example.com/${String(p.platform)}/1`,
      }));
      return Response.json({ post: { ...created, status: "published", platforms } });
    }
    return Response.json({ error: "unexpected", path }, { status: 500 });
  });
  vi.stubGlobal("fetch", fn);
  return {
    calls,
    posts: () => calls.filter((c) => c.method === "POST" && c.url === `${BASE}/v1/posts`),
    validations: () => calls.filter((c) => c.url === `${BASE}/v1/tools/validate/post`),
  };
}

/** A real SDK client over Streamable HTTP, wired straight into our route handler (no network). */
async function connect(cfg: Config, url = `https://mcp.test/mcp/${TOKEN}`) {
  const handle = createHandler(cfg);
  const token = new URL(url).pathname.split("/")[2];
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch: (input, init) => handle(new Request(input, init), token),
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

async function preview(client: Client, args: Record<string, unknown>) {
  const r = await client.callTool({ name: TOOL_NAMES.preview, arguments: args });
  expect(r.isError).toBeFalsy();
  return r.structuredContent as unknown as PreviewResult;
}

/** What the widget does: the payload crosses the host as JSON and comes back untouched. */
const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("preview_post -> publish_post", () => {
  it("POSTs to /v1/posts exactly the payload that was previewed (deep-equal and byte-identical)", async () => {
    const zernio = fakeZernio();
    const client = await connect(config());
    const p = await preview(client, { content: LONG, platforms: ["twitter", "bluesky", "linkedin", "tiktok"] });

    expect(p.targets.map((t) => [t.platform, t.state])).toEqual([
      ["twitter", "no_account"],
      ["bluesky", "ready"],
      ["linkedin", "ready"],
      ["tiktok", "no_account"],
    ]);
    expect(p.payload).not.toBeNull();
    expect(zernio.calls.some((c) => c.method !== "GET")).toBe(false); // preview never writes

    const { payload, payloadHash } = roundTrip({ payload: p.payload, payloadHash: p.payloadHash });
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: { payload, payloadHash } });
    expect(r.isError).toBeFalsy();

    const [sent] = zernio.posts();
    expect(zernio.posts()).toHaveLength(1);
    expect(JSON.parse(sent!.body!)).toEqual(p.payload);
    expect(canonicalJson(JSON.parse(sent!.body!))).toBe(canonicalJson(p.payload));
    expect(sent!.body).toBe(JSON.stringify(p.payload)); // same bytes, same key order

    // Validation uses the root segment for thread targets; the published body does not.
    const [validated] = zernio.validations();
    expect(JSON.parse(validated!.body!)).toEqual(validationBody(p.payload!));
    const bs = p.payload!.platforms.find((x) => x.platform === "bluesky")!;
    expect(Array.isArray(bs.platformSpecificData?.threadItems)).toBe(true);
    expect(bs.customContent).toBeUndefined();

    const result = r.structuredContent as unknown as PublishResult;
    expect(result.postId).toBe("post_new");
    expect(result.payloadHash).toBe(p.payloadHash);
    expect(result.platforms.map((x) => [x.platform, x.accountId, x.status, x.url])).toEqual([
      ["bluesky", "acc_bs", "published", "https://example.com/bluesky/1"],
      ["linkedin", "acc_li", "published", "https://example.com/linkedin/1"],
    ]);
  });

  it("refuses a payload with one character changed and POSTs nothing", async () => {
    const zernio = fakeZernio();
    const client = await connect(config());
    const p = await preview(client, { content: "Autumn menu on Thursday.", platforms: ["linkedin"] });
    const payload = roundTrip(p.payload!);
    payload.content = "Autumn menu on Thursday!";
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: { payload, payloadHash: p.payloadHash } });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/hash mismatch/);
    expect(zernio.posts()).toHaveLength(0);
    expect(zernio.validations()).toHaveLength(0);
  });

  it("refuses an accountId that is not in the profile, even with a matching hash", async () => {
    const zernio = fakeZernio();
    const client = await connect(config());
    const p = await preview(client, { content: "hello", platforms: ["linkedin"] });
    const payload = roundTrip(p.payload!);
    payload.platforms[0]!.accountId = "acc_someone_else";
    const { hashPayload } = await import("@zernio-elements/rules");
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: { payload, payloadHash: await hashPayload(payload) } });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/do not belong to this profile/);
    expect(zernio.posts()).toHaveLength(0);
  });

  it("refuses when MCP_ALLOW_PUBLISH is not set", async () => {
    const zernio = fakeZernio();
    const client = await connect(config({ allowPublish: false }));
    const p = await preview(client, { content: "hello", platforms: ["linkedin"] });
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: roundTrip({ payload: p.payload, payloadHash: p.payloadHash }) });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/MCP_ALLOW_PUBLISH/);
    expect(zernio.posts()).toHaveLength(0);
  });

  it("refuses when Zernio's validate/post says valid:false and returns its errors", async () => {
    const zernio = fakeZernio({ valid: false });
    const client = await connect(config());
    const p = await preview(client, { content: "hello", platforms: ["bluesky"] });
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: roundTrip({ payload: p.payload, payloadHash: p.payloadHash }) });
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.content)).toMatch(/bluesky: Text exceeds 300 characters/);
    expect(zernio.posts()).toHaveLength(0);
  });
});

describe("auth", () => {
  const init = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const post = (headers: Record<string, string> = {}) =>
    new Request("https://mcp.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify(init),
    });

  it("rejects a wrong token in the path with 404 and a missing/wrong Bearer with 401", async () => {
    fakeZernio();
    const handle = createHandler(config());
    expect((await handle(post(), "wrong")).status).toBe(404);
    expect((await handle(post(), "")).status).toBe(404);
    expect((await handle(post())).status).toBe(401);
    expect((await handle(post({ Authorization: "Bearer nope" }))).status).toBe(401);
    expect((await handle(post({ Authorization: `Bearer ${TOKEN}` }))).status).not.toBe(401);
  });

  it("refuses everything when MCP_TOKEN is not configured", async () => {
    fakeZernio();
    const handle = createHandler(config({ token: undefined }));
    expect((await handle(post(), "")).status).toBe(404);
    expect((await handle(post({ Authorization: "Bearer " }))).status).toBe(401);
  });

  it("does not reach the MCP client with a wrong path token", async () => {
    fakeZernio();
    await expect(connect(config(), "https://mcp.test/mcp/wrong")).rejects.toThrow();
  });
});

describe("discovery", () => {
  it("lists the tools with their widget and serves the widgets as MCP App HTML", async () => {
    fakeZernio();
    const client = await connect(config());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(Object.values(TOOL_NAMES).sort());
    const uri = (name: string) => (tools.find((t) => t.name === name)?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
    expect(uri(TOOL_NAMES.preview)).toBe(RESOURCE_URIS.preview);
    expect(uri(TOOL_NAMES.publish)).toBe(RESOURCE_URIS.preview);
    expect(uri(TOOL_NAMES.analytics)).toBe(RESOURCE_URIS.analytics);
    expect(uri(TOOL_NAMES.accounts)).toBe(RESOURCE_URIS.accounts);
    expect(uri(TOOL_NAMES.view)).toBe(RESOURCE_URIS.view);
    const publish = tools.find((t) => t.name === TOOL_NAMES.publish)?._meta as { ui: { visibility: string[] } };
    expect(publish.ui.visibility).toEqual(["app"]);
    expect(tools.find((t) => t.name === TOOL_NAMES.publish)?.annotations?.destructiveHint).toBe(true);

    for (const u of Object.values(RESOURCE_URIS)) {
      const r = await client.readResource({ uri: u });
      const c = r.contents[0] as { mimeType?: string; text?: string; _meta?: { ui?: { csp?: { resourceDomains?: string[] } } } };
      expect(c.mimeType).toBe(RESOURCE_MIME_TYPE);
      expect(c.text).toMatch(/<html/);
      expect(c._meta?.ui?.csp?.resourceDomains).toContain("https://images.unsplash.com");
    }
  });
});

describe("mock mode (no ZERNIO_API_KEY)", () => {
  it("previews and publishes from fixtures without calling fetch", async () => {
    const zernio = fakeZernio();
    const client = await connect(config({ apiKey: undefined, mock: true, profileId: "mock_profile" }));
    const p = await preview(client, { content: LONG, platforms: ["bluesky", "linkedin", "tiktok"] });
    expect(p.publishable).toEqual(["bluesky", "linkedin"]);
    expect((p as unknown as { mock?: boolean }).mock).toBe(true);
    const r = await client.callTool({ name: TOOL_NAMES.publish, arguments: roundTrip({ payload: p.payload, payloadHash: p.payloadHash }) });
    expect((r.structuredContent as { mock?: boolean }).mock).toBe(true);
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as unknown as PublishResult).status).toBe("published");
    const a = await client.callTool({ name: TOOL_NAMES.analytics, arguments: { days: 7 } });
    expect((a.structuredContent as { daily: unknown[] }).daily).toHaveLength(7);
    const acc = await client.callTool({ name: TOOL_NAMES.accounts, arguments: {} });
    expect(JSON.stringify(acc.content)).toMatch(/X needs a payment method|Connected accounts/);
    expect(zernio.calls).toHaveLength(0);
  });

  it("get_analytics handles 402 (no analytics add-on)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Analytics add-on required" }, { status: 402 })));
    const client = await connect(config());
    const r = await client.callTool({ name: TOOL_NAMES.analytics, arguments: {} });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ available: false, reason: "analytics_addon_required", days: 7 });
  });

  it("get_analytics labels sample data when the real period is empty (opt-in), and prefers real data", async () => {
    const empty = { dailyData: [], platformBreakdown: [], totals: { postCount: 0, impressions: 0 } };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(empty)));
    const off = await (await connect(config())).callTool({ name: TOOL_NAMES.analytics, arguments: {} });
    expect(off.structuredContent).toMatchObject({ sample: false, totals: { impressions: 0 } });
    const on = await (await connect(config({ sampleAnalyticsWhenEmpty: true }))).callTool({ name: TOOL_NAMES.analytics, arguments: {} });
    expect(on.structuredContent).toMatchObject({ sample: true });
    expect((on.structuredContent as { totals: { impressions: number } }).totals.impressions).toBeGreaterThan(0);
    expect(JSON.stringify(on.content)).toContain("SAMPLE DATA");
    const week = on.structuredContent as { totals: { impressions: number }; daily: Array<{ impressions: number }> };
    expect(week.totals.impressions).toBe(week.daily.reduce((n, d) => n + d.impressions, 0));
    const fortnight = (await (await connect(config({ sampleAnalyticsWhenEmpty: true }))).callTool({ name: TOOL_NAMES.analytics, arguments: { days: 14 } })).structuredContent as { totals: { impressions: number } };
    expect(fortnight.totals.impressions).toBeGreaterThan(week.totals.impressions);
    const real = { dailyData: [{ date: new Date().toISOString().slice(0, 10), postCount: 1, metrics: { impressions: 42 } }], totals: { postCount: 1, impressions: 42 } };
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(real)));
    const r = await (await connect(config({ sampleAnalyticsWhenEmpty: true }))).callTool({ name: TOOL_NAMES.analytics, arguments: {} });
    expect(r.structuredContent).toMatchObject({ sample: false, totals: { impressions: 42 } });
  });

  it("render_view renders a valid catalog spec and rejects an invalid one", async () => {
    const { EXAMPLES } = await import("@zernio-elements/catalog/server");
    const client = await connect(config());
    const ok = await client.callTool({ name: TOOL_NAMES.view, arguments: { title: "Week", spec: EXAMPLES[0]!.spec as unknown as Record<string, unknown> } });
    expect(ok.isError).toBeFalsy();
    expect((ok.structuredContent as { spec: { root: string } }).spec.root).toBeTruthy();
    const bad = {
      root: "a",
      elements: { a: { type: "StatTiles", props: { items: [{ label: "Impressions", value: -5 }] }, children: [] }, b: { type: "Iframe", props: {}, children: [] } },
    };
    const r = await client.callTool({ name: TOOL_NAMES.view, arguments: { spec: bad } });
    expect(r.isError).toBe(true);
    expect((r.structuredContent as { errors: string[] }).errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(r.content)).toMatch(/rejected/);
  });
});
