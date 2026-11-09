import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { H3, PageHeader, PropsTable, Section } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";

export const metadata: Metadata = { title: "Installation" };

export default function Installation() {
  return (
    <article className="max-w-[760px]">
      <PageHeader
        eyebrow="Getting started"
        title="Installation"
        description="Copy the source into your app with the shadcn CLI, or consume the workspace packages directly in a monorepo."
      />

      <Section title="With the shadcn CLI">
        <p>
          Works in any Next.js app with Tailwind CSS 4 and a <code>@/*</code> path alias. Run <code>npx shadcn@latest init</code> first
          if the project has no <code>components.json</code>.
        </p>
        <H3>1. Server handler</H3>
        <p>
          Adds <code>lib/zernio/server</code> and the catch-all route <code>app/api/zernio/[...path]/route.ts</code>. Set{" "}
          <code>ZERNIO_API_KEY</code>; without it the handler serves fixtures.
        </p>
        <InstallCommand name="zernio-server" />
        <H3>2. A component</H3>
        <p>Each component pulls in the hooks, the rules engine, the UI primitives and the theme tokens it needs.</p>
        <InstallCommand name="composer" />
        <H3>3. The provider</H3>
        <CodeBlock
          lang="tsx"
          title="app/providers.tsx"
          code={`"use client";

import { ZernioProvider } from "@/lib/zernio/provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ZernioProvider>{children}</ZernioProvider>;
}`}
        />
        <PropsTable
          props={[
            { name: "basePath", type: "string", default: '"/api/zernio"', description: "Where the server handler is mounted." },
            { name: "queryClient", type: "QueryClient", description: "Reuse your app's TanStack Query client. One is created otherwise." },
            { name: "children", type: "ReactNode", required: true, description: "Your app." },
          ]}
        />
      </Section>

      <Section title="In the monorepo">
        <p>
          Inside this repository the packages export TypeScript source directly. Add them as workspace dependencies and let Next transpile
          them.
        </p>
        <CodeBlock
          lang="json"
          title="package.json"
          code={`{
  "dependencies": {
    "@tanstack/react-query": "^5.90.0",
    "@zernio-elements/react": "workspace:*",
    "@zernio-elements/rules": "workspace:*",
    "@zernio-elements/server": "workspace:*"
  }
}`}
        />
        <CodeBlock
          lang="ts"
          title="next.config.ts"
          code={`const config: NextConfig = {
  transpilePackages: ["@zernio-elements/react", "@zernio-elements/rules", "@zernio-elements/server"],
};`}
        />
        <CodeBlock
          lang="css"
          title="app/globals.css"
          code={`@import "tailwindcss";
@import "@zernio-elements/react/theme.css";

/* Tailwind must scan the library so its classes are generated. */
@source "../../../packages/react/src";`}
        />
        <CodeBlock
          lang="ts"
          title="app/api/zernio/[...path]/route.ts"
          code={`import { createZernioHandler } from "@zernio-elements/server";

export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
  apiKey: process.env.ZERNIO_API_KEY,
  resolveTenant: async (req) => ({ profileId: await profileFor(req) }),
});`}
        />
      </Section>

      <PagerNav href="/installation" />
    </article>
  );
}
