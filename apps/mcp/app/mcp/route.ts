import { handler } from "../../lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * /mcp without credentials is the public demo (fixtures, nothing is posted). With `Authorization: Bearer <MCP_TOKEN>`
 * it is the real server; Claude custom connectors use /mcp/<MCP_TOKEN> instead.
 */
const handle = (req: Request) => handler(req);

export { handle as GET, handle as POST, handle as DELETE };
