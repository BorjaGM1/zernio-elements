// Smoke test a running server with the official SDK client over Streamable HTTP.
//   MCP_URL=http://localhost:3020/mcp/<token> node scripts/smoke.mjs
// Read-only: lists tools/resources and calls preview_post, get_analytics, check_accounts. Never publishes.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = process.env.MCP_URL;
if (!url) throw new Error("Set MCP_URL");

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => `${t.name} -> ${t._meta?.ui?.resourceUri} [${t._meta?.ui?.visibility ?? "model,app"}]`));
const { resources } = await client.listResources();
for (const r of resources) {
  const c = (await client.readResource({ uri: r.uri })).contents[0];
  console.log("resource:", r.uri, c.mimeType, `${c.text.length} chars`, JSON.stringify(c._meta?.ui?.csp));
}

const content =
  "The autumn tasting menu starts Thursday. Seven courses, all from producers within 80 km of the kitchen, paired with natural wines from our cellar.\n\nExpect wild mushrooms, line-caught hake, and the last txakoli before the harvest closes. Only 24 seats a night. Reservations open now.";
const preview = await client.callTool({
  name: "preview_post",
  arguments: { content, platforms: ["instagram", "twitter", "linkedin", "tiktok", "bluesky"] },
});
console.log("\npreview_post text:\n" + preview.content[0].text);
const s = preview.structuredContent;
console.log("payload:", JSON.stringify(s?.payload), "\npayloadHash:", s?.payloadHash);

for (const [name, args] of [["get_analytics", { days: 7 }], ["check_accounts", {}]]) {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n${name}${r.isError ? " (error)" : ""}:\n` + r.content[0].text);
}
await client.close();
