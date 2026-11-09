import { isOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return Response.json({ live: isOwner(req) });
}
