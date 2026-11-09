import { mockResponse } from "@zernio-elements/server";
import type { Config } from "./config";

export interface ZernioResponse<T> {
  status: number;
  ok: boolean;
  data: T;
}

/**
 * Minimal Zernio client. In mock mode every call is answered by @zernio-elements/server's fixtures and
 * nothing leaves the process (mock publish never touches Zernio).
 */
export function zernioClient(config: Config) {
  async function request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<ZernioResponse<T>> {
    let res: Response;
    if (config.mock) {
      const url = new URL(path, "http://mock");
      // The fixtures take a parsed body, as the handler would after reading the request.
      const parsed = body === undefined ? undefined : (JSON.parse(typeof body === "string" ? body : JSON.stringify(body)) as unknown);
      res = await mockResponse(method, url.pathname, parsed, url.searchParams);
    } else {
      res = await fetch(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        // A string body is sent as-is (publish_post sends the exact bytes it verified).
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      });
    }
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, ok: res.ok, data };
  }
  return { request };
}

export type ZernioClient = ReturnType<typeof zernioClient>;

/** Zernio error bodies vary: { error }, { message }, { errors: [...] }. */
export function errorText(data: unknown, status: number): string {
  const d = (data ?? {}) as { error?: unknown; message?: unknown; errors?: unknown };
  if (typeof d.error === "string") return d.error;
  if (typeof d.message === "string") return d.message;
  if (Array.isArray(d.errors)) return d.errors.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("; ");
  return `Zernio responded ${status}`;
}
