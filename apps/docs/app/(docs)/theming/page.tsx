import type { Metadata } from "next";
import { CodeBlock } from "@/components/code-block";
import { Mono, PageHeader, Section, Table } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";
import { TOKEN_DOCS } from "@/lib/catalog";
import { themeTokens } from "@/lib/source";

export const metadata: Metadata = { title: "Theming" };
export const dynamic = "force-static";

const isColor = (v: string) => /^#|^rgb|^hsl|^oklch/.test(v);

export default function Theming() {
  const tokens = themeTokens();
  return (
    <article className="max-w-[760px]">
      <PageHeader
        eyebrow="Getting started"
        title="Theming"
        description="Every component reads only --ze-* CSS variables. A white-label theme is a different set of values, nothing else."
      />

      <Section title="Tokens">
        <p>
          Defaults from <code>packages/react/src/styles/theme.css</code>, applied on <code>:root</code> and on{" "}
          <code>[data-ze-theme=&quot;default&quot;]</code>.
        </p>
        <Table
          head={["Token", "Default", "Used for"]}
          rows={tokens.map((t) => [
            <Mono key="n" strong>
              {t.name}
            </Mono>,
            <span key="v" className="inline-flex items-center gap-2">
              {isColor(t.value) && (
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-line" style={{ background: t.value }} />
              )}
              <code className="font-mono text-[12.5px] text-fg-2">{t.value}</code>
            </span>,
            TOKEN_DOCS[t.name] ?? "",
          ])}
        />
        <InstallCommand name="zernio-theme" />
      </Section>

      <Section title="A theme per tenant">
        <p>
          Scope a theme with <code>data-ze-theme</code> on any ancestor, or set the variables from your tenant&apos;s settings at runtime.
          These are the three fictional brands used in the previews.
        </p>
        <CodeBlock
          lang="css"
          title="globals.css"
          code={`[data-ze-theme="hostly"] {
  --ze-surface: #fff5f2;
  --ze-primary: #e8573c;
  --ze-radius: 16px;
  --ze-font: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
}

[data-ze-theme="ferment"] {
  --ze-bg: #151311;
  --ze-fg: #f3ede4;
  --ze-primary: #d9b25f;
  --ze-radius: 4px;
  --ze-font: Georgia, "Times New Roman", serif;
}`}
        />
        <CodeBlock
          lang="tsx"
          code={`<div data-ze-theme={tenant.theme}>
  <Composer />
</div>`}
        />
      </Section>

      <PagerNav href="/theming" />
    </article>
  );
}
