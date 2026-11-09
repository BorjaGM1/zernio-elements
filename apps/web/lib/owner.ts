/**
 * The public demo serves fixtures. Real accounts (and real publishing) only for the owner:
 * visit /api/demo/unlock?key=<ZERNIO_DEMO_SECRET> once to set an httpOnly cookie.
 * Without a secret, live mode is allowed only outside production (local dev with a key).
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "ze_owner";

/** The cookie holds a hash of the secret, never the secret itself. */
export const ownerToken = (secret: string) => createHash("sha256").update(`ze-owner:${secret}`).digest("hex");

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function hasKey(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY) && process.env.ZERNIO_MOCK !== "1";
}

export function isOwner(req: Request): boolean {
  if (!hasKey()) return false;
  const secret = process.env.ZERNIO_DEMO_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const expected = ownerToken(secret);
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.split(/;\s*/).some((c) => c.startsWith(`${OWNER_COOKIE}=`) && same(c.slice(OWNER_COOKIE.length + 1), expected));
}
