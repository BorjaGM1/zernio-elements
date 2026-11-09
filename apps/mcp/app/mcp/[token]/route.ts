import { handler } from "../../../lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// publish_post polls Zernio for up to ~20s for the live links.
export const maxDuration = 60;

type Ctx = { params: Promise<{ token: string }> };
const handle = async (req: Request, { params }: Ctx) => handler(req, (await params).token);

export { handle as GET, handle as POST, handle as DELETE };
