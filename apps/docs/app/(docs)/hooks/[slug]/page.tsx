import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/code-block";
import { Mono, PageHeader, PropsTable, Section, Table } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";
import { HOOKS } from "@/lib/catalog";

export const dynamicParams = false;

export function generateStaticParams() {
  return HOOKS.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = HOOKS.find((h) => h.slug === slug);
  return doc ? { title: doc.name, description: doc.description } : {};
}

export default async function HookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = HOOKS.find((h) => h.slug === slug);
  if (!doc) notFound();

  const names = doc.name.split(" / ").join(", ");

  return (
    <article className="max-w-[760px]">
      <PageHeader eyebrow="Hooks" title={doc.name} description={doc.description} />

      <Section title="Signature">
        <CodeBlock code={doc.signature} lang="ts" />
      </Section>

      <Section title="Installation">
        <InstallCommand name="zernio-hooks" />
        <p>
          Ships <code>lib/zernio/provider.tsx</code> and <code>lib/zernio/hooks</code>. Every hook must render inside{" "}
          <code>{"<ZernioProvider>"}</code>.
        </p>
      </Section>

      <Section title="Usage">
        <CodeBlock code={`import { ${names} } from "@/lib/zernio/hooks";\n\n${doc.usage}`} lang="tsx" />
      </Section>

      <Section title="Returns">
        <PropsTable props={doc.returns} />
      </Section>

      <Section title="Endpoints">
        <p>Called through your server handler, scoped to the tenant&apos;s profile.</p>
        <Table head={["Method", "Path"]} rows={doc.endpoints.map((e) => e.split(" ")).map(([m, p]) => [<Mono key="m" strong>{m}</Mono>, <Mono key="p">{p}</Mono>])} />
      </Section>

      <PagerNav href={`/hooks/${doc.slug}`} />
    </article>
  );
}
