/**
 * Generates the shadcn registry (public/r/*.json) and public/llms.txt from the package sources,
 * so what `npx shadcn add` installs is always exactly what is in packages/.
 *
 *   node --experimental-strip-types scripts/build-registry.ts
 *
 * The @zernio-elements packages are not on npm, so every item ships source. Cross-package and relative
 * imports are rewritten to the install targets (@/lib/zernio/..., @/components/zernio/...), and
 * registryDependencies / npm dependencies are derived from those imports, so new files and new imports
 * in packages/ are picked up without touching this script.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COMPONENTS, HOOKS, RULES_API } from "../lib/catalog.ts";
import { parseTokens } from "../lib/tokens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../../..");
const PKG = (...p: string[]) => path.join(REPO_ROOT, "packages", ...p);

export const SCHEMA_ITEM = "https://ui.shadcn.com/schema/registry-item.json";
export const SCHEMA_INDEX = "https://ui.shadcn.com/schema/registry.json";

/** Provided by the host app; never listed as dependencies. */
const PEER = new Set(["react", "react-dom", "next"]);

type ItemType = "registry:lib" | "registry:hook" | "registry:component" | "registry:theme" | "registry:file";

export interface RegistryFile {
  path: string;
  type: ItemType;
  target: string;
  content: string;
}

export interface RegistryItem {
  $schema: string;
  name: string;
  type: ItemType;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: RegistryFile[];
  cssVars?: { light: Record<string, string> };
  docs?: string;
}

interface SourceFile {
  abs: string;
  type: ItemType;
  target: string;
}

interface ItemDef {
  name: string;
  type: ItemType;
  title: string;
  description: string;
  sources: SourceFile[];
  /** Files that are not copied from packages/ (e.g. the Next route). */
  extra?: Array<Omit<RegistryFile, "content"> & { content: string }>;
  alwaysDepends?: string[];
  cssVars?: { light: Record<string, string> };
  docs?: string;
}

const isCode = (f: string) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.endsWith(".d.ts");
const list = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter(isCode).sort() : []);

const ROUTE_FILE = `import { createZernioHandler } from "@/lib/zernio/server";

/**
 * The only server code your app needs. resolveTenant maps the logged-in customer to their Zernio profile.
 * Without ZERNIO_API_KEY the handler serves fixtures (mock mode).
 */
export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
  apiKey: process.env.ZERNIO_API_KEY,
  resolveTenant: async () => ({ profileId: process.env.ZERNIO_PROFILE_ID ?? "default" }),
});
`;

function itemDefs(): ItemDef[] {
  const rulesDir = PKG("rules", "src");
  const serverDir = PKG("server", "src");
  const reactDir = PKG("react", "src");
  const hooksDir = path.join(reactDir, "hooks");
  const componentsDir = path.join(reactDir, "components");

  const themeCss = readFileSync(path.join(reactDir, "styles", "theme.css"), "utf8");
  const light = Object.fromEntries(parseTokens(themeCss).map((t) => [t.name.replace(/^--/, ""), t.value]));

  const defs: ItemDef[] = [
    {
      name: "zernio-rules",
      type: "registry:lib",
      title: "Zernio rules engine",
      description: "Per-platform publishing rules: SPECS, validate, adapt, splitThread, toCreatePostBody. Zero dependencies.",
      sources: list(rulesDir).map((f) => ({ abs: path.join(rulesDir, f), type: "registry:lib", target: `lib/zernio/rules/${f}` })),
    },
    {
      name: "zernio-hooks",
      type: "registry:hook",
      title: "Zernio hooks and provider",
      description: "ZernioProvider plus TanStack Query hooks: useComposer, useAccounts, usePosts, useInbox, useMessages, useAnalytics, useConnect.",
      sources: [
        { abs: path.join(reactDir, "provider.tsx"), type: "registry:lib", target: "lib/zernio/provider.tsx" },
        ...list(hooksDir).map((f): SourceFile => ({ abs: path.join(hooksDir, f), type: "registry:hook", target: `lib/zernio/hooks/${f}` })),
      ],
    },
    {
      name: "zernio-server",
      type: "registry:lib",
      title: "Zernio server handler",
      description: "createZernioHandler: keeps the API key server-side, scopes every call to the tenant's profile, endpoint allowlist, mock mode. Includes the Next.js catch-all route.",
      sources: list(serverDir).map((f) => ({ abs: path.join(serverDir, f), type: "registry:lib", target: `lib/zernio/server/${f}` })),
      extra: [
        { path: "registry/zernio/route.ts", type: "registry:file", target: "app/api/zernio/[...path]/route.ts", content: ROUTE_FILE },
      ],
      docs: "Set ZERNIO_API_KEY in your environment and edit resolveTenant in app/api/zernio/[...path]/route.ts.",
    },
    {
      name: "zernio-theme",
      type: "registry:theme",
      title: "Zernio theme tokens",
      description: "The --ze-* design tokens every component reads. Override them per tenant for white-label.",
      sources: [],
      cssVars: { light },
    },
    {
      name: "zernio-ui",
      type: "registry:component",
      title: "Zernio UI primitives",
      description: "Card, Button, PlatformBadge, Section and cn, styled only through --ze-* tokens.",
      sources: [{ abs: path.join(componentsDir, "ui.tsx"), type: "registry:component", target: "components/zernio/ui.tsx" }],
      alwaysDepends: ["zernio-theme"],
    },
  ];

  for (const f of list(componentsDir)) {
    if (f === "ui.tsx") continue;
    const name = f.replace(/\.tsx?$/, "");
    const docs = COMPONENTS.filter((c) => c.registry === name);
    defs.push({
      name,
      type: "registry:component",
      title: docs.map((d) => d.name).join(", ") || name,
      description: docs[0]?.description ?? `Zernio Elements ${name}.`,
      sources: [{ abs: path.join(componentsDir, f), type: "registry:component", target: `components/zernio/${f}` }],
      alwaysDepends: ["zernio-theme"],
    });
  }
  return defs;
}

/** Entry file for each internal package, from its package.json "exports". */
function packageEntry(spec: string): string | undefined {
  const m = spec.match(/^@zernio-elements\/([^/]+)(\/.*)?$/);
  if (!m) return undefined;
  const pkgDir = PKG(m[1] ?? "");
  const pj = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")) as { exports?: Record<string, string> };
  const sub = m[2] ? `.${m[2]}` : ".";
  const rel = pj.exports?.[sub];
  return rel ? path.join(pkgDir, rel) : undefined;
}

function resolveRelative(from: string, spec: string): string | undefined {
  const base = path.resolve(path.dirname(from), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(c) && isCode(c)) return c;
  }
  return undefined;
}

const aliasFor = (target: string) => `@/${target.replace(/\.(tsx?)$/, "").replace(/\/index$/, "")}`;

const npmName = (spec: string) => (spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec));

export interface BuildOptions {
  outDir: string;
  siteUrl: string;
}

export function buildRegistry({ outDir, siteUrl }: BuildOptions): RegistryItem[] {
  const base = siteUrl.replace(/\/$/, "");
  const url = (name: string) => `${base}/r/${name}.json`;
  const defs = itemDefs();

  // Where every shipped source file lands, and which item ships it.
  const owner = new Map<string, { item: string; target: string }>();
  for (const d of defs) for (const s of d.sources) owner.set(s.abs, { item: d.name, target: s.target });

  const items: RegistryItem[] = defs.map((d) => {
    const deps = new Set<string>();
    const regDeps = new Set<string>(d.alwaysDepends ?? []);

    const files: RegistryFile[] = d.sources.map((s) => {
      const src = readFileSync(s.abs, "utf8");
      const content = src.replace(
        /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g,
        (whole, lead: string, q: string, spec: string) => {
          let resolved: string | undefined;
          if (spec.startsWith(".")) resolved = resolveRelative(s.abs, spec);
          else if (spec.startsWith("@zernio-elements/")) resolved = packageEntry(spec);
          else {
            if (!spec.startsWith("node:") && !PEER.has(npmName(spec))) deps.add(npmName(spec));
            return whole;
          }
          const hit = resolved ? owner.get(resolved) : undefined;
          if (!hit) throw new Error(`${path.relative(REPO_ROOT, s.abs)}: cannot map import "${spec}" to a registry item`);
          if (hit.item !== d.name) regDeps.add(hit.item);
          return `${lead}${q}${aliasFor(hit.target)}${q}`;
        },
      );
      return { path: path.relative(REPO_ROOT, s.abs), type: s.type, target: s.target, content };
    });

    for (const e of d.extra ?? []) {
      for (const m of e.content.matchAll(/from\s*["'](@\/[^"']+)["']/g)) {
        const target = [...owner.values()].find((o) => aliasFor(o.target) === m[1]);
        if (target && target.item !== d.name) regDeps.add(target.item);
      }
      files.push({ ...e });
    }

    const item: RegistryItem = {
      $schema: SCHEMA_ITEM,
      name: d.name,
      type: d.type,
      title: d.title,
      description: d.description,
    };
    if (deps.size) item.dependencies = [...deps].sort();
    if (regDeps.size) item.registryDependencies = [...regDeps].sort().map(url);
    if (files.length) item.files = files;
    if (d.cssVars) item.cssVars = d.cssVars;
    if (d.docs) item.docs = d.docs;
    return item;
  });

  const rDir = path.join(outDir, "r");
  rmSync(rDir, { recursive: true, force: true });
  mkdirSync(rDir, { recursive: true });
  for (const item of items) writeFileSync(path.join(rDir, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`);

  const index = {
    $schema: SCHEMA_INDEX,
    name: "zernio-elements",
    homepage: base,
    items: items.map(({ $schema: _s, files, ...rest }) => ({
      ...rest,
      ...(files ? { files: files.map(({ content: _c, ...f }) => f) } : {}),
    })),
  };
  writeFileSync(path.join(rDir, "registry.json"), `${JSON.stringify(index, null, 2)}\n`);

  writeFileSync(path.join(outDir, "llms.txt"), llmsTxt(items, base));
  return items;
}

function llmsTxt(items: RegistryItem[], base: string): string {
  const install = (name: string) => `npx shadcn@latest add ${base}/r/${name}.json`;
  const lines = [
    "# Zernio Elements",
    "",
    "> Plug-and-play React components, headless hooks and a per-platform rules engine for the Zernio API (one REST API for publishing, inbox and analytics across 15 publishing platforms). Distributed as a shadcn registry that ships source.",
    "",
    "One kit, three surfaces, same rules engine and components underneath:",
    "",
    `- Embeddable components: connect, composer, previews, calendar, inbox and analytics, installed with the shadcn CLI into your app. The Zernio key stays server-side behind createZernioHandler. Docs: ${base}/components/composer`,
    `- MCP App: preview and approval widgets inside the chat, verified live in Claude; built on the MCP Apps spec (@modelcontextprotocol/ext-apps), so other MCP Apps hosts (ChatGPT, VS Code, Goose) should work but were not tested. preview_post builds the exact POST /v1/posts body and its sha256 payloadHash; the widget renders it. publish_post is widget-only (visibility: ["app"], per the MCP Apps spec): Claude does not give it to the model; the server also requires the exact previewed payload and hash, and MCP_ALLOW_PUBLISH stays off as the backstop for hosts that ignore visibility. Tools: preview_post, publish_post, get_analytics, check_accounts, render_view. Docs: ${base}/agents/mcp-app`,
    `- Generative UI: a json-render catalog (@zernio-elements/catalog) of 11 tested components with zod props. catalogPrompt() constrains the model, validateCatalogSpec() rejects unknown components and bad prop values, <CatalogView> renders only valid specs. Docs: ${base}/agents/generative-ui`,
    "",
    "## Links",
    "",
    `- MCP App docs and connector setup: ${base}/agents/mcp-app`,
    "- MCP server: https://zernio-elements-mcp.vercel.app (the endpoint is /mcp/<token>; the token is private)",
    "- Embeddable demo, 3 brands: https://zernio-elements.vercel.app (public visitors see demo data)",
    "- The whole frontend in one file: https://zernio-elements.vercel.app/six-lines",
    `- Generative UI: https://zernio-elements.vercel.app/compose and ${base}/agents/generative-ui`,
    `- Docs and component catalog: ${base}`,
    `- shadcn registry: ${base}/r/registry.json`,
    `- llms.txt: ${base}/llms.txt`,
    "",
    "## Setup",
    "",
    `1. Server handler (keeps the API key server-side, scopes calls to the tenant's profile): ${install("zernio-server")}`,
    "2. Wrap the app in <ZernioProvider> (from @/lib/zernio/provider, installed by zernio-hooks; basePath defaults to /api/zernio).",
    "3. Add any component below. Each one pulls in its hooks, rules and theme tokens.",
    "",
    "## Components",
    "",
    ...COMPONENTS.map((c) => `- ${c.name}: ${c.description} Install: ${install(c.registry)} Docs: ${base}/components/${c.slug}`),
    "",
    "## Hooks (zernio-hooks)",
    "",
    ...HOOKS.map((h) => `- ${h.name}: ${h.description} Calls ${h.endpoints.join(", ")}. Docs: ${base}/hooks/${h.slug}`),
    "",
    "## Rules engine (zernio-rules, zero dependencies, runs anywhere)",
    "",
    ...RULES_API.map((r) => `- ${r.signature}: ${r.description}`),
    "- SPECS: Record<PlatformId, PlatformSpec> with text limits, count mode, feed truncation, title, media and hashtag rules per platform.",
    "",
    "## Registry items",
    "",
    ...items.map((i) => `- ${i.name} (${i.type}): ${base}/r/${i.name}.json`),
    `- Index: ${base}/r/registry.json`,
    "",
    "## Theming",
    "",
    "Every component reads only --ze-* CSS variables (bg, surface, fg, muted, border, primary, primary-fg, danger, warning, info, success, radius, font). Scope a theme with data-ze-theme=\"<name>\" on any ancestor.",
    "",
  ];
  return lines.join("\n");
}

export function defaultSiteUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3001";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = path.resolve(HERE, "../public");
  const siteUrl = defaultSiteUrl();
  const items = buildRegistry({ outDir, siteUrl });
  console.log(`registry: ${items.length} items -> public/r (${siteUrl}), llms.txt`);
}
