/** Static server for dist/ (widgets) + dist-harness/ (host page). No dependencies. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname } from "node:path";

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };

export function serve(port = 4317) {
  const server = createServer(async (req, res) => {
    if (req.url === "/favicon.ico") return res.writeHead(204).end();
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname).replace(/^\/+/, "") || "host.html";
    for (const dir of ["dist-harness", "dist"]) {
      try {
        const file = resolve(pkg, dir, path);
        if (!file.startsWith(resolve(pkg, dir))) break;
        const body = await readFile(file);
        res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
        return res.end(body);
      } catch {}
    }
    res.writeHead(404).end("not found");
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}
