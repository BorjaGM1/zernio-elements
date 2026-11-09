// The endpoint lives at /mcp/<token>; this page only says what the server is. It never shows the token.
const DOCS = "https://zernio-elements-docs.vercel.app/agents/mcp-app";

export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px" }}>
      <p style={{ margin: 0, fontSize: 13, color: "#6b6b68" }}>Zernio Elements</p>
      <h1 style={{ margin: "6px 0 12px", fontSize: 26, lineHeight: 1.2, letterSpacing: "-0.01em" }}>MCP server</h1>
      <p style={{ margin: "0 0 12px" }}>
        Lets the person see and approve exactly what an agent is about to post, inside the chat. The approval widget renders the
        actual request payload, bound by a hash, so what gets approved is what gets published.
      </p>
      <p style={{ margin: "0 0 12px", color: "#6b6b68" }}>
        Verified live in Claude. Built on the MCP Apps spec (@modelcontextprotocol/ext-apps), so other MCP Apps hosts (ChatGPT, VS Code,
        Goose) should work but were not tested.
      </p>
      <p style={{ margin: "0 0 24px", color: "#6b6b68" }}>
        This endpoint is private: requests need a secret token. To run your own, see the setup guide.
      </p>
      <a href={DOCS} style={{ color: "#111", fontWeight: 600 }}>
        Setup guide
      </a>
    </main>
  );
}
