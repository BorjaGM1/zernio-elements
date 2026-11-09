import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/code-block";
import { ComponentPreview } from "@/components/component-preview";
import { Callout, PageHeader, PropsTable, Section } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";
import { COMPONENTS } from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPONENTS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = COMPONENTS.find((c) => c.slug === slug);
  return doc ? { title: doc.name, description: doc.description } : {};
}

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = COMPONENTS.find((c) => c.slug === slug);
  if (!doc) notFound();

  const fullExample = `"use client";

import { ZernioProvider } from "@/lib/zernio/provider";
${doc.usage.split("\n").filter((l) => l.startsWith("import")).join("\n")}

export default function Page() {
  return (
    <ZernioProvider>
${doc.usage
  .split("\n")
  .filter((l) => l.trim().startsWith("<"))
  .map((l) => `      ${l.trim()}`)
  .join("\n") || `      <${doc.name} />`}
    </ZernioProvider>
  );
}`;

  return (
    <article className="max-w-[1040px]">
      <PageHeader eyebrow="Components" title={doc.name} description={doc.description} />

      <ComponentPreview slug={doc.slug} code={<CodeBlock code={fullExample} lang="tsx" title={`app/${doc.slug}/page.tsx`} />} />

      <div className="mt-14 max-w-[760px]">
        <Section title="Installation">
          <InstallCommand name={doc.registry} />
          <p>
            Installs <code>components/zernio/{doc.registry}.tsx</code> and everything it imports: hooks, rules engine, UI primitives and
            theme tokens. Add the <a href="/server">server handler</a> once per app.
          </p>
        </Section>

        <Section title="Usage">
          <CodeBlock code={doc.usage} lang="tsx" />
          {doc.notes?.map((n) => (
            <Callout key={n}>{n}</Callout>
          ))}
        </Section>

        <Section title="Props">
          <PropsTable props={doc.props} />
        </Section>

        <PagerNav href={`/components/${doc.slug}`} />
      </div>
    </article>
  );
}
