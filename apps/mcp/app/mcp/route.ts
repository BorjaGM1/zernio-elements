import { handler } from "../../lib/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** /mcp with `Authorization: Bearer <MCP_TOKEN>`. Claude custom connectors use /mcp/<MCP_TOKEN> instead. */
const handle = (req: Request) => handler(req);

export { handle as GET, handle as POST, handle as DELETE };
