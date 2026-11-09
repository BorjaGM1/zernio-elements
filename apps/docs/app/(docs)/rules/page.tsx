import type { Metadata } from "next";
import { PLATFORM_IDS, SPECS } from "@zernio-elements/rules";
import { CodeBlock } from "@/components/code-block";
import { Callout, H3, Mono, PageHeader, Section, Table } from "@/components/docs";
import { InstallCommand } from "@/components/install-command";
import { PagerNav } from "@/components/pager";
import { RULES_API } from "@/lib/catalog";

export const metadata: Metadata = { title: "Rules engine" };

const num = (n?: number) => (n === undefined ? <span className="text-muted">-</span> : <span className="tabular-nums">{n.toLocaleString("en-US")}</span>);
const yes = (b?: boolean) => (b ? <span className="text-fg">Yes</span> : <span className="text-muted">No</span>);

export default function RulesPage() {
  return (
    <article className="max-w-[1040px]">
      <PageHeader
        eyebrow="Rules engine"
        title="validate, adapt, splitThread"
        description="Zero-dependency TypeScript that knows each platform's limits. It powers instant keystroke-level feedback and the previews; Zernio's validate endpoint stays the authoritative check on publish."
      />

      <div className="max-w-[760px]">
        <Section title="Installation">
          <InstallCommand name="zernio-rules" />
          <p>
            Pure functions, no React, no network. Runs in the browser, on the server, or in an agent tool call. Installs to{" "}
            <code>lib/zernio/rules</code>.
          </p>
        </Section>

        <Section title="API">
          {RULES_API.map((fn) => (
            <div key={fn.name} className="space-y-3">
              <H3>
                <code className="font-mono text-[14px]">{fn.name}</code>
              </H3>
              <p>{fn.description}</p>
              <CodeBlock code={`${fn.signature}\n\n${fn.usage}`} lang="ts" />
            </div>
          ))}
        </Section>
      </div>

      <Section title="Platform specs">
        <p className="max-w-[760px]">
          Rendered from the <code>SPECS</code> object the components use. Limits are counted in graphemes, except X which uses weighted
          counting (URLs count 23, CJK and emoji count 2).
        </p>
        <Table
          head={["Platform", "Id", "Max chars", "Counting", "Feed cut", "Threads", "Title", "Media", "Needs media", "Video (s)"]}
          rows={PLATFORM_IDS.map((id) => {
            const s = SPECS[id];
            return [
              <span key="n" className="whitespace-nowrap font-medium text-fg">
                {s.name}
              </span>,
              <Mono key="i">{id}</Mono>,
              num(s.text.maxLength),
              <Mono key="c">{s.text.countMode}</Mono>,
              num(s.text.previewTruncateAt),
              yes(s.text.supportsThreads),
              s.title ? (
                <span key="t" className="whitespace-nowrap">
                  {s.title.required ? "Required" : "Optional"}, {s.title.maxLength}
                </span>
              ) : (
                <span key="t" className="text-muted">-</span>
              ),
              num(s.media.maxItems),
              yes(s.media.required),
              num(s.media.video?.maxDurationSec),
            ];
          })}
        />
        <div className="max-w-[760px]">
          <Callout>
            {PLATFORM_IDS.every((id) => SPECS[id].verified)
              ? "Every spec has been verified against Zernio's platform docs."
              : `${PLATFORM_IDS.filter((id) => !SPECS[id].verified).length} of ${PLATFORM_IDS.length} specs are marked unverified in the source and are being checked against Zernio's platform docs and POST /v1/tools/validate/post-length.`}
          </Callout>
        </div>
      </Section>

      <div className="max-w-[760px]">
        <PagerNav href="/rules" />
      </div>
    </article>
  );
}
