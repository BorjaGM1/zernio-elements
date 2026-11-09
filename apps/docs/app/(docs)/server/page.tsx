import type { Metadata } from "next";
import { DEFAULT_RULES } from "@zernio-elements/server";
import { CodeBlock } from "@/components/code-block";
import { Callout, Mono, PageHeader, PropsTable, Section, Table } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";

export const metadata: Metadata = { title: "Server handler" };

/** Turn the allowlist regex back into a readable path. */
const readable = (re: RegExp) =>
  re.source
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\\\//g, "/")
    .replace(/\[A-Za-z0-9_-\]\+/g, "{id}");

export default function ServerPage() {
  return (
    <article className="max-w-[760px]">
      <PageHeader
        eyebrow="Getting started"
        title="Server handler"
        description="createZernioHandler is the only server code you need. Your API key stays on the server and every request is scoped to the current tenant's Zernio profile."
      />

      <Section title="Installation">
        <InstallCommand name="zernio-server" />
      </Section>

      <Section title="Usage">
        <CodeBlock
          lang="ts"
          title="app/api/zernio/[...path]/route.ts"
          code={`import { createZernioHandler } from "@/lib/zernio/server";
import { auth } from "@/lib/auth";

export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
  apiKey: process.env.ZERNIO_API_KEY,
  resolveTenant: async (req) => {
    const session = await auth(req);
    if (!session) return null; // 401
    return { profileId: session.org.zernioProfileId };
  },
});`}
        />
        <p>
          It only uses <code>Request</code> and <code>Response</code>, so it also mounts in Hono, Remix or SvelteKit.
        </p>
      </Section>

      <Section title="Options">
        <PropsTable
          props={[
            {
              name: "resolveTenant",
              type: "(req: Request) => Tenant | null | Promise<…>",
              required: true,
              description: "Map your session, cookie or JWT to { profileId, apiKey? }. Return null to reject with 401.",
            },
            { name: "apiKey", type: "string", description: "Workspace API key. Server-side only. A tenant's own apiKey takes precedence." },
            { name: "baseUrl", type: "string", default: '"https://zernio.com/api"', description: "Zernio API base URL." },
            { name: "basePath", type: "string", default: '"/api/zernio"', description: "Where the handler is mounted. Must match ZernioProvider." },
            { name: "mock", type: "boolean", default: "!apiKey", description: "Serve in-memory fixtures instead of calling Zernio. These docs run in mock mode." },
            { name: "rules", type: "Rule[]", default: "DEFAULT_RULES", description: "Replace or extend the endpoint allowlist." },
          ]}
        />
      </Section>

      <Section title="Tenant scoping">
        <p>
          For list endpoints the handler overwrites <code>profileId</code> in the query string with the tenant&apos;s, so a customer can
          never read another profile. For writes it checks that every <code>accountId</code> in the body belongs to the tenant before
          forwarding, and answers 403 otherwise.
        </p>
      </Section>

      <Section title="Allowlist">
        <p>
          The browser can only reach these endpoints through the handler. Anything else is rejected with 403. Rendered from{" "}
          <code>DEFAULT_RULES</code>.
        </p>
        <Table
          head={["Method", "Path", "Scoped to profile", "Checks account ownership"]}
          rows={DEFAULT_RULES.map((r) => [
            <Mono key="m" strong>
              {r.method}
            </Mono>,
            <Mono key="p">{readable(r.pattern)}</Mono>,
            r.scopeQuery ? <span key="s" className="text-fg">Yes</span> : <span key="s" className="text-muted">-</span>,
            r.checkBodyAccounts ? <span key="c" className="text-fg">Yes</span> : <span key="c" className="text-muted">-</span>,
          ])}
        />
        <Callout>
          Extend it with <code>rules: [...DEFAULT_RULES, {"{ method: \"GET\", pattern: /^\\/v1\\/queue\\/slots$/, scopeQuery: true }"}]</code>.
        </Callout>
      </Section>

      <PagerNav href="/server" />
    </article>
  );
}
