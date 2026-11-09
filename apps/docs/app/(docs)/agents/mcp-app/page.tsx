import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { Callout, Mono, PageHeader, Section, Table } from "@/components/docs";
import { PagerNav } from "@/components/pager";

export const metadata: Metadata = {
  title: "MCP App",
  description: "Preview and approval widgets for the Zernio API inside Claude, built on the MCP Apps spec. What the person approves is exactly what gets published.",
};

/** Widget screenshots from packages/widgets/screenshots (720px frame, dark host theme, 2x). */
function Shot({ src, alt, caption, height }: { src: string; alt: string; caption: string; height: number }) {
  return (
    <figure>
      <Image
        src={src}
        alt={alt}
        width={768}
        height={height}
        sizes="(min-width: 768px) 760px, 100vw"
        className="h-auto w-full rounded-lg border border-line"
      />
      <figcaption className="mt-2.5 text-[13px] leading-relaxed text-muted">{caption}</figcaption>
    </figure>
  );
}

const YES = <span className="text-fg">Yes</span>;

/** Keeps the description column readable on phones; the table scrolls sideways instead of stacking one word per line. */
const Desc = ({ children }: { children: ReactNode }) => <span className="block min-w-[220px]">{children}</span>;

const ENV: [string, string][] = [
  ["MCP_TOKEN", "Required. Secret in the connector URL. Generate one with openssl rand -hex 32."],
  ["ZERNIO_API_KEY", "Zernio API key, from your Zernio dashboard (see docs.zernio.com). Without it the server serves fixtures (mock mode)."],
  ["ZERNIO_PROFILE_ID", "The Zernio profile the server acts on. Profile IDs are listed in the dashboard and by GET /v1/profiles."],
  ["MCP_ALLOW_PUBLISH", "Set to 1 to let publish_post publish. Off by default."],
  ["MCP_SAMPLE_ANALYTICS_WHEN_EMPTY", "Set to 1 to show sample analytics, labelled as such, when the period has no activity."],
  ["MCP_PUBLISH_MODEL_VISIBLE", "Set to 1 only for hosts that can't call app-only tools: lists publish_post to the model too."],
];

export default function McpAppPage() {
  return (
    <article className="max-w-[760px]">
      <PageHeader
        eyebrow="Agents"
        title="MCP App"
        description="Your MCP lets agents post. This lets the person see and approve exactly what the agent is about to post, inside the chat."
      />

      <Shot
        src="/widgets/preview-720-dark.png"
        alt="Review before publishing widget: LinkedIn and Bluesky marked Will publish, TikTok Needs attention, X and Instagram Preview only, a LinkedIn preview of the post, a Publish 2 button and the payload hash."
        caption="preview_post in Claude. Platforms without an account are preview only; TikTok is blocked until it gets a video."
        height={496}
      />

      <div className="mt-10 prose-docs space-y-4 text-[15px]">
        <p>
          The approval widget renders the actual request body, bound by a hash, not a description written by the model. Verified live in
          Claude, including a real publish from the widget. It is built on the MCP Apps spec (<code>@modelcontextprotocol/ext-apps</code>),
          so other MCP Apps hosts (ChatGPT, VS Code, Goose) should work but were not tested; hosts without UI get the tools&apos; text
          output. Same rules engine and components as the <Link href="/components/composer">embeddable kit</Link>.
        </p>
      </div>

      <Section title="How it works">
        <ol className="list-decimal space-y-2.5 pl-5 text-fg-2 marker:text-muted">
          <li>
            <code>preview_post</code> adapts the post for each platform and builds the exact <code>POST /v1/posts</code> body, plus a{" "}
            <code>payloadHash</code>: sha256 of its canonical JSON. Nothing is published.
          </li>
          <li>The widget renders that payload: per-platform previews, thread splits, blocking issues, and the raw body under &quot;What will be sent&quot;.</li>
          <li>
            Inline edits call <code>preview_post</code> again with per-platform overrides, so the payload and its hash are rebuilt on the
            server, never patched in the widget.
          </li>
          <li>
            Publish calls <code>publish_post</code> with the payload and hash unchanged. The server recomputes the hash and refuses any
            mismatch, runs Zernio&apos;s <code>validate/post</code>, then sends that exact body.
          </li>
          <li>
            <code>publish_post</code> is widget-only (<code>visibility: [&quot;app&quot;]</code>, per the MCP Apps spec): Claude
            doesn&apos;t give it to the model, so only the person&apos;s click can publish. That part is host-enforced. The server adds
            its own checks: it requires the exact previewed payload and hash, and marks the tool destructive so hosts that prompt will
            ask. <code>MCP_ALLOW_PUBLISH</code> is the backstop for hosts that ignore visibility: keep it off there.
          </li>
        </ol>
        <Shot
          src="/widgets/preview-published-720-dark.png"
          alt="Published widget: LinkedIn and Bluesky marked Published with Open post links, and a note that the sha256 matches what was approved."
          caption="After Publish, the same widget shows live links and confirms the published hash matches the approved one."
          height={549}
        />
      </Section>

      <Section title="Tools">
        <Table
          head={["Tool", "What it does", "Widget", "Model-visible"]}
          rows={[
            [
              <Mono key="n" strong>
                preview_post
              </Mono>,
              <Desc key="d">Adapts the post per platform, flags blocking issues, builds the publish payload and its hash. Never publishes.</Desc>,
              "Preview and approval",
              YES,
            ],
            [
              <Mono key="n" strong>
                publish_post
              </Mono>,
              <Desc key="d">Checks the hash, validates with Zernio, POSTs the approved payload, returns per-platform status and live URLs.</Desc>,
              "Preview and approval (updates in place)",
              <span key="v" className="text-muted">
                No, widget-only
              </span>,
            ],
            [
              <Mono key="n" strong>
                get_analytics
              </Mono>,
              <Desc key="d">Impressions, engagement, clicks and posts for the last N days, with the daily series and a per-platform breakdown.</Desc>,
              "Analytics",
              YES,
            ],
            [
              <Mono key="n" strong>
                check_accounts
              </Mono>,
              <Desc key="d">Connected accounts and their health, with connect or reconnect links for the ones that need it.</Desc>,
              "Accounts",
              YES,
            ],
            [
              <Mono key="n" strong>
                render_view
              </Mono>,
              <Desc key="d">
                Renders a view the model composes from the <Link href="/agents/generative-ui">json-render catalog</Link>, after validating
                every element and prop.
              </Desc>,
              "Custom view",
              YES,
            ],
          ]}
        />
        <p>Every tool declares its widget and also returns plain text, so hosts without MCP Apps still get a useful answer.</p>
        <Shot
          src="/widgets/analytics-720-dark.png"
          alt="Analytics widget: last 14 days, totals for impressions, engagement, link clicks and posts, a daily bar chart with the peak day highlighted, and impressions by platform."
          caption="get_analytics: totals, a daily chart with the peak highlighted, and the split by platform."
          height={510}
        />
      </Section>

      <Section title="Security">
        <ul className="list-disc space-y-2.5 pl-5 text-fg-2 marker:text-line-strong">
          <li>
            The server URL publishes to real accounts, so every request needs a secret token, in the path (<code>/mcp/&lt;MCP_TOKEN&gt;</code>)
            or as a Bearer header. Without <code>MCP_TOKEN</code> set, every request is refused, including <code>tools/list</code>.
          </li>
          <li>
            Publishing is off unless <code>MCP_ALLOW_PUBLISH=1</code>. Without it, <code>publish_post</code> answers that nothing was
            published.
          </li>
          <li>The Zernio API key stays on the server. It never reaches the host, the model or the widget.</li>
          <li>
            Widgets run in the host&apos;s sandboxed iframe and never call Zernio or any API. Buttons (Publish, Edit, Reconnect) ask the host
            to call the MCP tool through the ext-apps bridge.
          </li>
        </ul>
      </Section>

      <Section title="Try the demo">
        <p>
          In Claude, open <strong className="font-medium text-fg">Settings → Connectors → Add custom connector</strong> and paste the demo
          URL. It serves every tool and widget on sample accounts and data: Publish is simulated, nothing reaches Zernio and nothing is posted.
        </p>
        <CodeBlock code="https://zernio-elements-mcp.vercel.app/mcp" lang="bash" title="Demo connector URL" />
      </Section>

      <Section title="Run your own">
        <ol className="list-decimal space-y-2.5 pl-5 text-fg-2 marker:text-muted">
          <li>
            Deploy <code>apps/mcp</code> (a Next.js app; on Vercel, set the project root to <code>apps/mcp</code>) with the environment
            variables below.
          </li>
          <li>
            In Claude, open <strong className="font-medium text-fg">Settings → Connectors → Add custom connector</strong> and paste the URL:
          </li>
        </ol>
        <CodeBlock code="https://<your-deployment>/mcp/<MCP_TOKEN>" lang="bash" title="Connector URL" />
        <p>
          Then ask in a new chat, for example &quot;Announce our autumn menu on Instagram, X, LinkedIn and Bluesky&quot;. Claude reads a
          chat&apos;s tool list when the chat starts, and asks for permission the first time each tool runs.
        </p>

        <dl className="overflow-hidden rounded-lg border border-line text-[13px]">
          {ENV.map(([name, description]) => (
            <div key={name} className="border-b border-line px-3.5 py-2.5 last:border-0 sm:flex sm:gap-6">
              <dt className="shrink-0 sm:w-[250px]">
                <Mono strong>{name}</Mono>
              </dt>
              <dd className="mt-1 leading-relaxed text-fg-2 sm:mt-0">{description}</dd>
            </div>
          ))}
        </dl>
        <p>
          Get <code>ZERNIO_API_KEY</code> and <code>ZERNIO_PROFILE_ID</code> from your Zernio account (<a href="https://docs.zernio.com">docs.zernio.com</a>).
          Zernio supports scoped API keys, so create one for this server scoped to that profile (<code>profileIds</code>), with{" "}
          <code>read-write</code> permission and an <code>expiresIn</code>, rather than reusing an account-wide key.
        </p>
        <Callout>
          Treat the connector URL like a password: anyone with it can preview, and with <code>MCP_ALLOW_PUBLISH=1</code> publish, to the
          connected accounts.
        </Callout>
      </Section>

      <Section title="Next">
        <ul className="list-disc space-y-2.5 pl-5 text-fg-2 marker:text-line-strong">
          <li>
            <strong className="font-medium text-fg">Use your own Zernio account.</strong> A connect page that takes a profile-scoped,
            expiring key and returns a personal connector URL, with the key encrypted in the URL with a server secret and nothing
            stored. Not shipped yet; today one deployment serves one profile.
          </li>
          <li>
            <strong className="font-medium text-fg">Deploy your own.</strong> A Vercel project with root directory <code>apps/mcp</code> and
            the environment variables above. That works today; it is how the demo server runs.
          </li>
        </ul>
      </Section>

      <PagerNav href="/agents/mcp-app" />
    </article>
  );
}
