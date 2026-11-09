import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

// Shows the real source of page.tsx and the API route next to the running result. Read at build time.
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8").trim();

const KEYWORDS = /\b(import|from|export|default|function|return|const|async|await)\b/g;

function Code({ file, source }: { file: string; source: string }) {
  const lines = source.split("\n");
  return (
    <figure className="overflow-hidden rounded-md border border-[#2a2a2a] bg-[#0f0f0f]">
      <figcaption className="flex items-center justify-between border-b border-[#2a2a2a] px-4 py-2 font-mono text-[11px] text-[#8a8a8a]">
        <span>{file}</span>
        <span>{lines.length} lines</span>
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-[#e6e6e6]">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-7 shrink-0 text-right text-[#555] select-none">{i + 1}</span>
            <code className="pl-4" dangerouslySetInnerHTML={{ __html: highlight(line) }} />
          </div>
        ))}
      </pre>
    </figure>
  );
}

function highlight(line: string) {
  const esc = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/(&quot;|"[^"]*")/g, '<span style="color:#b5d99c">$1</span>')
    .replace(/(\/\/.*)$/, '<span style="color:#6b6b6b">$1</span>')
    .replace(KEYWORDS, '<span style="color:#9ab8ff">$1</span>')
    .replace(/(&lt;\/?)([A-Z]\w*)/g, '$1<span style="color:#f0c674">$2</span>');
}

const ROUTE = `import { createZernioHandler } from "@zernio-elements/server";

const handler = createZernioHandler({
  apiKey: process.env.ZERNIO_API_KEY,
  // Your session decides which profile this user may touch.
  resolveTenant: async (req) => ({
    profileId: await profileFor(req),
  }),
});

export const { GET, POST, PUT, DELETE } = handler;`;

export default function SixLinesLayout({ children }: { children: ReactNode }) {
  const page = read("app/six-lines/page.tsx");
  // The demo's own route adds an owner gate for the public URL; this is the part a SaaS writes.
  const route = ROUTE;
  return (
    <div className="min-h-screen bg-[#f6f6f5] text-[#111] [font-family:system-ui]">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-6 py-8 xl:grid-cols-[480px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 xl:sticky xl:top-8 xl:self-start">
          <div>
            <a href="/" className="text-xs text-[#6b6b68] underline-offset-2 hover:underline">
              Back to the demo
            </a>
            <h1 className="mt-3 text-[26px] leading-tight font-semibold tracking-tight">This is the whole frontend.</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#6b6b68]">
              Connect, compose with live per-platform previews, and a calendar, on real Zernio data. One component file and one route.
            </p>
          </div>
          <Code file="app/six-lines/page.tsx" source={page} />
          <Code file="app/api/zernio/[...path]/route.ts" source={route} />
        </aside>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
