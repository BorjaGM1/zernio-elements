import type { Metadata } from "next";
import Link from "next/link";
import { catalog, EXAMPLES, validateCatalogSpec } from "@zernio-elements/catalog";
import { CodeBlock } from "@/components/code-block";
import { ComponentPreview } from "@/components/component-preview";
import { Mono, PageHeader, Section, Table } from "@/components/docs";
import { PagerNav } from "@/components/pager";

export const metadata: Metadata = {
  title: "Generative UI",
  description: "A json-render catalog of Zernio Elements: agents compose views only from tested components, with every prop validated.",
};

type ComponentDef = {
  description: string;
  slots?: string[];
  props: { shape?: Record<string, { safeParse: (v: unknown) => { success: boolean } }> };
};

/** Read from the real catalog object, so this table can't drift from what validateCatalogSpec accepts. */
const COMPONENT_ROWS = Object.entries(catalog.data.components as unknown as Record<string, ComponentDef>).map(([name, def]) => ({
  name,
  description: def.description,
  container: Boolean(def.slots?.length),
  props: Object.entries(def.props.shape ?? {}).map(([prop, schema]) => ({ prop, optional: schema.safeParse(undefined).success })),
}));

const WEEKLY = EXAMPLES.find((e) => e.id === "weekly-report")!;

/** A spec with the mistakes a model makes. The errors below are what validateCatalogSpec really returns. */
const BAD_SPEC = {
  root: "page",
  elements: {
    page: { type: "Stack", props: { title: "Last week" }, children: ["totals", "split", "chart"] },
    totals: { type: "StatTiles", props: { items: [{ label: "Impressions", value: -120 }] }, children: [] },
    split: { type: "PlatformBreakdown", props: { metric: "Impressions", rows: [{ platform: "myspace", value: 900 }] }, children: [] },
    chart: { type: "PieChart", props: {}, children: [] },
  },
};
const BAD_ERRORS = (() => {
  const check = validateCatalogSpec(BAD_SPEC);
  return check.ok ? [] : check.errors;
})();

/** One element per line: short enough to read, still valid JSON. */
const BAD_SPEC_TEXT = [
  "{",
  `  "root": "page",`,
  `  "elements": {`,
  ...Object.entries(BAD_SPEC.elements).map(([k, el], i, all) => `    ${JSON.stringify(k)}: ${JSON.stringify(el)}${i < all.length - 1 ? "," : ""}`),
  "  }",
  "}",
].join("\n");

const DEMO = `${(process.env.NEXT_PUBLIC_DEMO_URL ?? "https://zernio-elements.vercel.app").replace(/\/$/, "")}/compose`;

export default function GenerativeUiPage() {
  return (
    <article className="max-w-[1040px]">
      <PageHeader
        eyebrow="Agents"
        title="Generative UI"
        description="A json-render catalog of Zernio Elements. The model picks the blocks and fills in the numbers; every block is a tested component, and every prop is checked before anything renders."
      />

      <ComponentPreview
        slug="catalog-weekly-report"
        code={<CodeBlock code={JSON.stringify(WEEKLY.spec, null, 2)} lang="json" title="weekly-report spec" />}
      />
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        The <code className="font-mono text-[12.5px]">weekly-report</code> spec from <code className="font-mono text-[12.5px]">EXAMPLES</code>,
        rendered by <code className="font-mono text-[12.5px]">&lt;CatalogView&gt;</code>. Prompt: &quot;{WEEKLY.prompt}&quot;
      </p>

      <div className="mt-14 max-w-[760px]">
        <Section title="Why a catalog">
          <p>
            Letting a model write HTML gives you views that look different every time and numbers nobody checked. Here the model writes a
            small JSON spec instead, and it can only use the components below: the same tested, themed components as the{" "}
            <Link href="/components/composer">embeddable kit</Link>.
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-fg-2 marker:text-line-strong">
            <li>Unknown components are rejected, with the list of allowed ones.</li>
            <li>
              Props are validated with zod, values included: negative counts, unknown platform ids, malformed dates and over-long text all
              fail.
            </li>
            <li>No state, expressions or actions. Every value is a literal, so the view is read-only and renders the same everywhere.</li>
            <li>Post previews compute truncation, thread splits and blocking issues with the rules engine, not the model.</li>
          </ul>
          <p>For example, this spec has three mistakes:</p>
          <CodeBlock code={BAD_SPEC_TEXT} lang="json" title="spec.json" />
          <p>
            <code>validateCatalogSpec</code> refuses it, and nothing renders:
          </p>
          <figure className="overflow-hidden rounded-lg border border-line bg-code">
            <figcaption className="flex h-10 items-center border-b border-line px-4 font-mono text-[12px] text-muted">
              validateCatalogSpec(spec).errors
            </figcaption>
            <ul className="space-y-2 px-5 py-4 font-mono text-[13px] leading-[1.7] text-fg-2 [overflow-wrap:anywhere]">
              {BAD_ERRORS.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </figure>
        </Section>

        <Section title="Components">
          <p>
            {COMPONENT_ROWS.length} components, read from the catalog itself. Optional props end in <code>?</code>.
          </p>
          <Table
            head={["Component", "Description and props"]}
            rows={COMPONENT_ROWS.map((c) => [
              <span key="n" className="block">
                <Mono strong>{c.name}</Mono>
                <span className="mt-0.5 block text-[12px] text-muted">{c.container ? "Container" : "Leaf"}</span>
              </span>,
              <span key="d" className="block min-w-[180px]">
                {c.description}
                <span className="mt-1.5 block">
                  {c.props.map((p, i) => (
                    <span key={p.prop}>
                      <Mono>{`${p.prop}${p.optional ? "?" : ""}`}</Mono>
                      {i < c.props.length - 1 ? ", " : null}
                    </span>
                  ))}
                </span>
              </span>,
            ])}
          />
        </Section>

        <Section title="In your app">
          <p>
            Give the model <code>catalogPrompt()</code> as its system prompt, validate what it returns, and render only a spec that passes.
            The <code>./server</code> entry has no React, so the first half runs in any backend.
          </p>
          <CodeBlock
            lang="tsx"
            code={`import { catalogPrompt, parseAndValidate } from "@zernio-elements/catalog/server";
import { CatalogView } from "@zernio-elements/catalog";

// Components, prop types, rules, and the only facts the model may use
const system = catalogPrompt({ data: analytics });

// JSONL patch lines or one JSON object
const check = parseAndValidate(modelOutput);

if (!check.ok) retryWith(check.errors); // send the errors back to the model
else return <CatalogView spec={check.spec} />;`}
          />
        </Section>

        <Section title="The render_view tool">
          <p>
            The <Link href="/agents/mcp-app">MCP App</Link> exposes the catalog as <code>render_view(spec, title?)</code>. Its description
            carries the catalog prompt, so the model can compose a report, a checklist or an account overview from earlier tool
            results. The server validates the spec; an invalid one comes back to the model as a list of errors to fix, and a valid one
            renders in the custom view widget.
          </p>
        </Section>

        <Section title="Try it">
          <p>
            The <a href={DEMO}>compose demo</a> runs the whole loop: a prompt, the model&apos;s spec streaming in, validation, and the
            rendered view. Without model credentials it shows the example specs, labelled as examples.
          </p>
        </Section>

        <PagerNav href="/agents/generative-ui" />
      </div>
    </article>
  );
}
