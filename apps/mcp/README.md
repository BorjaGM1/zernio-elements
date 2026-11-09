# apps/mcp

The remote MCP server (Next.js, `@modelcontextprotocol/ext-apps`), deployed on Vercel with this directory as the project
root. `/mcp/[token]` (or `/mcp` with `Authorization: Bearer`) is the real server; `/mcp` without credentials is a
public demo on fixtures that never reaches Zernio. Both serve the tools `preview_post`, `publish_post` (widget-only), `get_analytics`,
`check_accounts` and `render_view`, and the widget HTML from `packages/widgets` as `ui://` resources. `/` is a landing
page that never shows the token. Env: `MCP_TOKEN` (required), `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID`, `MCP_ALLOW_PUBLISH`,
`MCP_SAMPLE_ANALYTICS_WHEN_EMPTY`; the full list and the Claude setup are on
https://zernio-elements-docs.vercel.app/agents/mcp-app.

Run with `pnpm --filter mcp dev` (port 3020). Test with `pnpm --filter mcp test` (`test/mcp.test.ts`, including the check
that the widget payload and the body sent to Zernio are identical).
