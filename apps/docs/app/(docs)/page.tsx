import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { PageHeader, Section } from "@/components/docs";
import { PagerNav } from "@/components/pager";
import { COMPONENTS } from "@/lib/catalog";

const SIX_LINES = `import { ZernioProvider } from "@/lib/zernio/provider";
import { ConnectAccounts } from "@/components/zernio/connect-accounts";
import { Composer } from "@/components/zernio/composer";
import { Calendar } from "@/components/zernio/calendar";

export default function Social() {
  return (
    <ZernioProvider>
      <ConnectAccounts />
      <Composer />
      <Calendar />
    </ZernioProvider>
  );
}`;

const DEMO = "https://zernio-elements.vercel.app";

/** Every public URL of the project, in the order a reviewer should look. Mirrored in README.md and llms.txt. */
const LINKS: { label: string; href: string; note: string }[] = [
  { label: "MCP App docs and connector setup", href: "/agents/mcp-app", note: "How the hash binds approval to the payload; add it to Claude." },
  { label: "MCP server", href: "https://zernio-elements-mcp.vercel.app", note: "Try it in Claude: add https://zernio-elements-mcp.vercel.app/mcp as a custom connector (sample data, nothing is posted)." },
  { label: "Embeddable demo, 3 brands", href: DEMO, note: "Same components, three themes. Public visitors see demo data." },
  { label: "The whole frontend in one file", href: `${DEMO}/six-lines`, note: "One component file and one API route." },
  { label: "Generative UI", href: `${DEMO}/compose`, note: "A model composes views from the catalog; see /agents/generative-ui." },
  { label: "shadcn registry", href: "/r/registry.json", note: "npx shadcn@latest add .../r/composer.json" },
  { label: "llms.txt", href: "/llms.txt", note: "The kit summarised for a coding agent." },
];

const SURFACES = [
  {
    title: "Embeddable components",
    href: "/components/composer",
    description: "Connect, composer, previews, calendar, inbox and analytics, copied into your app with the shadcn CLI. Your key stays server-side.",
  },
  {
    title: "MCP App",
    href: "/agents/mcp-app",
    description: "Preview and approval widgets inside Claude, built on the MCP Apps spec. The person approves the exact payload that gets published.",
  },
  {
    title: "Generative UI",
    href: "/agents/generative-ui",
    description: "A json-render catalog: models compose views only from tested components, with every prop validated.",
  },
];

export default function Introduction() {
  const demo = process.env.NEXT_PUBLIC_DEMO_URL;
  return (
    <article className="max-w-[760px]">
      <PageHeader
        title="Zernio Elements"
        description="Components, hooks and a per-platform rules engine for the Zernio API. One kit, three surfaces, same logic underneath: embed it in your product, put it in front of an agent inside Claude as an MCP App, or let a model compose views from it."
      />

      <ul className="mb-12 grid gap-3 sm:grid-cols-3">
        {SURFACES.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block h-full rounded-lg border border-line px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-subtle"
            >
              <span className="block text-[14px] font-medium text-fg">{s.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted">{s.description}</span>
            </Link>
          </li>
        ))}
      </ul>

      <Section title="Links">
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line text-[13px]">
          {LINKS.map((l) => (
            <li key={l.href} className="px-3.5 py-2.5 sm:flex sm:gap-4">
              <a href={l.href} className="shrink-0 font-medium text-fg sm:w-[260px]">
                {l.label}
              </a>
              <span className="mt-0.5 block leading-relaxed text-muted sm:mt-0">{l.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="prose-docs space-y-4 text-[15px]">
        <p>
          Zernio is one REST API for publishing, inbox and analytics across 15 publishing platforms. Elements is the frontend every
          product built on it would otherwise write by hand: a kit you embed, not an app you fork. The code is copied into your project
          with the shadcn CLI, so you own it and can change anything.
        </p>
        <ul className="list-disc space-y-1.5 pl-5 text-fg-2 marker:text-line-strong">
          <li>
            <strong className="font-medium text-fg">Components</strong> styled only through <code>--ze-*</code> tokens, so each tenant can
            look like its own product.
          </li>
          <li>
            <strong className="font-medium text-fg">Hooks</strong> on TanStack Query for when you want your own UI.
          </li>
          <li>
            <strong className="font-medium text-fg">Rules engine</strong> that knows each platform&apos;s limits, thread splitting and feed
            truncation. Zero dependencies.
          </li>
          <li>
            <strong className="font-medium text-fg">Server handler</strong> that keeps your API key server-side and scopes every call to the
            tenant&apos;s profile.
          </li>
        </ul>
      </div>

      <Section title="The whole frontend">
        <p>One component file and one API route. Once the handler is mounted, this page is a full social media workspace:</p>
        <CodeBlock code={SIX_LINES} lang="tsx" title="app/social/page.tsx" />
        {demo ? (
          <p>
            See it running inside three fictional products in the <a href={demo}>demo app</a>.
          </p>
        ) : null}
      </Section>

      <Section title="Components">
        <ul className="grid gap-3 sm:grid-cols-2">
          {COMPONENTS.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/components/${c.slug}`}
                className="block h-full rounded-lg border border-line px-4 py-3.5 no-underline transition-colors hover:border-line-strong hover:bg-subtle"
                style={{ textDecoration: "none" }}
              >
                <span className="block text-[14px] font-medium text-fg">{c.name}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted">{c.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="For agents">
        <p>
          Agents get the same kit two ways: the <Link href="/agents/mcp-app">MCP App</Link> shows previews and an approval step inside the
          chat (verified in Claude; publishing is widget-only, so the model never calls <code>publish_post</code> there), and <Link href="/agents/generative-ui">Generative UI</Link> lets a model build views from the catalog. To write code with
          the kit, point your agent at <a href="/llms.txt">/llms.txt</a>; every registry item is plain JSON under{" "}
          <a href="/r/registry.json">/r/registry.json</a>.
        </p>
      </Section>

      <PagerNav href="/" />
    </article>
  );
}
