import { OWNER_COOKIE } from "@/lib/owner";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return new Response(null, {
    status: 303,
    headers: { Location: new URL("/", req.url).toString(), "Set-Cookie": `${OWNER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
  });
}
