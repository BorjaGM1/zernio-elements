import { DEFAULT_RULES, matchRule, type Rule } from "./allowlist";
import { mockResponse } from "./mock";

export interface Tenant {
  /** Zernio profile this request is allowed to act on. */
  profileId: string;
  /** Optional per-tenant (profile-scoped) API key. Falls back to options.apiKey. */
  apiKey?: string;
}

export interface ZernioHandlerOptions {
  /** Workspace API key. Server-side only. */
  apiKey?: string;
  /** Defaults to https://zernio.com/api */
  baseUrl?: string;
  /** Where the handler is mounted. Defaults to /api/zernio */
  basePath?: string;
  /** Serve fixtures instead of calling Zernio. Defaults to true when no apiKey is set. */
  mock?: boolean;
  /**
   * Map the incoming request (your session/cookie/JWT) to a Zernio profile.
   * Return null to reject with 401. This is what makes it safe for multi-tenant SaaS.
   */
  resolveTenant: (req: Request) => Promise<Tenant | null> | Tenant | null;
  /** Override or extend the endpoint allowlist. */
  rules?: Rule[];
}

type Handler = (req: Request) => Promise<Response>;

/**
 * Mount in Next.js at app/api/zernio/[...path]/route.ts:
 *
 *   export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
 *     apiKey: process.env.ZERNIO_API_KEY,
 *     resolveTenant: async (req) => ({ profileId: await profileFor(req) }),
 *   });
 *
 * Works with any fetch-style framework (Hono, Remix, SvelteKit) since it only uses Request/Response.
 */
export function createZernioHandler(opts: ZernioHandlerOptions): Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler> {
  const baseUrl = (opts.baseUrl ?? "https://zernio.com/api").replace(/\/$/, "");
  const basePath = opts.basePath ?? "/api/zernio";
  const mock = opts.mock ?? !opts.apiKey;
  const rules = opts.rules ?? DEFAULT_RULES;
  const accountCache = new Map<string, { ids: Set<string>; at: number }>();

  async function accountsFor(tenant: Tenant, key: string, fresh = false): Promise<Set<string>> {
    const hit = accountCache.get(tenant.profileId);
    if (!fresh && hit && Date.now() - hit.at < 30_000) return hit.ids;
    const res = await fetch(`${baseUrl}/v1/accounts?profileId=${encodeURIComponent(tenant.profileId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = (await res.json().catch(() => ({}))) as { accounts?: Array<{ _id: string }> };
    const ids = new Set((data.accounts ?? []).map((a) => a._id));
    // Only cache a real answer: caching a failed lookup would reject every account for 30s.
    if (res.ok) accountCache.set(tenant.profileId, { ids, at: Date.now() });
    return ids;
  }

  /** Ids not owned by the tenant. Refetches once on a miss, so a just-connected account is not rejected. */
  async function foreignAccounts(tenant: Tenant, key: string, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    let owned = await accountsFor(tenant, key);
    if (ids.every((id) => owned.has(id))) return [];
    owned = await accountsFor(tenant, key, true);
    return ids.filter((id) => !owned.has(id));
  }

  async function postBelongsTo(tenant: Tenant, key: string, postId: string): Promise<boolean> {
    const res = await fetch(`${baseUrl}/v1/posts/${encodeURIComponent(postId)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return false;
    const { post } = (await res.json().catch(() => ({}))) as {
      post?: { profileId?: string | { _id?: string }; platforms?: Array<{ accountId?: string | { _id?: string } }> };
    };
    if (!post) return false;
    const profile = typeof post.profileId === "object" ? post.profileId?._id : post.profileId;
    if (profile) return profile === tenant.profileId;
    const ids = (post.platforms ?? [])
      .map((p) => (typeof p.accountId === "object" ? p.accountId?._id : p.accountId))
      .filter((id): id is string => Boolean(id));
    return ids.length > 0 && (await foreignAccounts(tenant, key, ids)).length === 0;
  }

  const handle: Handler = async (req) => {
    const url = new URL(req.url);
    const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) || "/" : url.pathname;

    const rule = matchRule(rules, req.method, path);
    if (!rule) return Response.json({ error: "Endpoint not allowed", path }, { status: 403 });

    const tenant = await opts.resolveTenant(req);
    if (!tenant) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = req.method === "GET" || req.method === "DELETE" ? undefined : await req.json().catch(() => undefined);
    const query = new URLSearchParams(url.search);

    if (mock) return mockResponse(req.method, path, body, query);

    const key = tenant.apiKey ?? opts.apiKey;
    if (!key) return Response.json({ error: "No Zernio API key configured" }, { status: 500 });

    if (rule.scopeQuery) query.set("profileId", tenant.profileId);
    if (rule.scopeBody && body && typeof body === "object") (body as { profileId?: string }).profileId = tenant.profileId;
    if (rule.dropBodyKeys && body && typeof body === "object") for (const k of rule.dropBodyKeys) delete (body as Record<string, unknown>)[k];

    const requested = query.getAll("accountId");
    if (rule.checkBodyAccounts && body && typeof body === "object") {
      const b = body as { accountId?: unknown; platforms?: Array<{ accountId?: unknown }> };
      for (const id of [b.accountId, ...(b.platforms ?? []).map((p) => p.accountId)]) {
        if (typeof id === "string" && id) requested.push(id);
      }
    }
    const foreign = await foreignAccounts(tenant, key, requested);
    if (foreign.length) {
      return Response.json({ error: "Account does not belong to this profile", accountIds: foreign }, { status: 403 });
    }

    if (rule.checkPostOwner) {
      const postId = path.split("/")[3] ?? "";
      if (!(await postBelongsTo(tenant, key, postId))) {
        return Response.json({ error: "Post not found" }, { status: 404 });
      }
    }

    const upstream = await fetch(`${baseUrl}${path}${query.size ? `?${query}` : ""}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  };

  return { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}

export { DEFAULT_RULES, type Rule } from "./allowlist";
/** Fixture responses (mock mode), for other servers that talk to Zernio, e.g. apps/mcp. */
export { mockResponse } from "./mock";
