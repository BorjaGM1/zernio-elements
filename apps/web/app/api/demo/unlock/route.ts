import { OWNER_COOKIE, ownerToken } from "@/lib/owner";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.ZERNIO_DEMO_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) return new Response("Not found", { status: 404 });
  const res = Response.redirect(new URL("/", url), 303);
  const headers = new Headers(res.headers);
  headers.append("Set-Cookie", `${OWNER_COOKIE}=${ownerToken(secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return new Response(null, { status: 303, headers });
}
