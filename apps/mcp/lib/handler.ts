import { createHash, timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { configFromEnv, type Config } from "./config";
import { createMcpServer } from "./server";
import { zernioClient } from "./zernio";

/** Constant-time comparison (hashing first makes the lengths equal, so the length isn't leaked either). */
export function tokenMatches(given: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const bearer = (req: Request) => req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;

/**
 * The whole server: auth in front of a stateless Streamable HTTP MCP endpoint.
 * - `pathToken` is the token from the URL (/mcp/<token>), for clients that only take a URL (Claude custom connectors).
 *   A wrong one is a 404: the URL simply doesn't exist.
 * - Without a path token, `Authorization: Bearer <token>` is required (401 otherwise).
 * Nothing (not even tools/list) is served before the token checks out.
 */
export function createHandler(config: Config = configFromEnv()) {
  const zernio = zernioClient(config);
  const mcp = createMcpHandler(() => createMcpServer(config, zernio), { legacy: "stateless" });

  return async function handle(req: Request, pathToken?: string): Promise<Response> {
    if (pathToken !== undefined) {
      if (!tokenMatches(pathToken, config.token) && !tokenMatches(bearer(req), config.token)) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
    } else if (!tokenMatches(bearer(req), config.token)) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
    }
    // One log line per JSON-RPC message (method, tool, argument size, duration); never logs arguments or the token.
    const started = Date.now();
    const peek = req.method === "POST" ? await req.clone().text().catch(() => "") : "";
    let label = req.method;
    try {
      const msgs = [JSON.parse(peek || "null")].flat().filter(Boolean) as Array<{ method?: string; params?: { name?: string } }>;
      label = msgs.map((m) => (m.method === "tools/call" ? `tools/call:${m.params?.name}` : (m.method ?? "response"))).join(",") || req.method;
    } catch {}
    // This stateless server pushes no notifications. Answer subscriptions/listen with "method not found"
    // instead of opening an SSE stream that the platform cuts after 60s (Claude opens one on connect).
    const listen = label === "subscriptions/listen" ? ([JSON.parse(peek)].flat()[0] as { id?: unknown }) : null;
    if (listen) {
      console.log(`[mcp] subscriptions/listen -> not supported`);
      return Response.json({ jsonrpc: "2.0", id: listen.id ?? null, error: { code: -32601, message: "Method not found: this server sends no notifications" } });
    }
    const res = await mcp.fetch(req);
    console.log(`[mcp] ${label} ${peek.length}B -> ${res.status} ${res.headers.get("content-type") ?? ""} in ${Date.now() - started}ms`);
    return res;
  };
}

let shared: ReturnType<typeof createHandler> | undefined;
/** One handler per server instance, built from the environment on first use. */
export const handler = (req: Request, pathToken?: string) => (shared ??= createHandler())(req, pathToken);
