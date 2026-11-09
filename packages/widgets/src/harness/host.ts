/**
 * A tiny MCP Apps host for development, screenshots and e2e checks. It embeds a built widget in a
 * sandboxed iframe and talks to it with the SDK's AppBridge over the real postMessage protocol:
 * host context (theme + style variables), tool input, tool result, and answers to callServerTool and
 * openLink from fixtures.
 *
 * URL params: widget=preview-post|analytics|accounts  theme=light|dark  styles=claude|none
 *   scenario=result|loading|streaming|error|cancelled|nothing|publish-hang|publish-error|publish-partial|edit-hang|edit-error
 *   width=<px>
 */
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { McpUiHostContext, McpUiStyles } from "@modelcontextprotocol/ext-apps/app-bridge";
import { TOOL_NAMES, buildPreview, type PreviewPostInput, type PublishPostInput } from "@zernio-elements/rules";
import { EXAMPLES } from "@zernio-elements/catalog";
import {
  DEMO_INPUT,
  FAKE_ACCOUNTS,
  accountsFixture,
  analyticsFixture,
  analyticsSampleFixture,
  analyticsUnavailableFixture,
  partialPublishFixture,
  previewFixture,
  publishFixture,
  renderViewErrorFixture,
} from "./fixtures";

const q = new URLSearchParams(location.search);
const widget = q.get("widget") ?? "preview-post";
const theme = (q.get("theme") === "dark" ? "dark" : "light") as "light" | "dark";
const scenario = q.get("scenario") ?? "result";
const width = Number(q.get("width") ?? 720);

/** Approximation of a Claude-like palette, to prove host variables flow into --ze-* tokens. */
const CLAUDE_LIKE: Record<"light" | "dark", Partial<McpUiStyles>> = {
  light: {
    "--color-background-primary": "#ffffff",
    "--color-background-secondary": "#f7f6f2",
    "--color-background-tertiary": "#f0eee8",
    "--color-text-primary": "#141413",
    "--color-text-secondary": "#6f6d66",
    "--color-border-primary": "rgba(31, 30, 29, 0.24)",
    "--color-border-secondary": "rgba(31, 30, 29, 0.12)",
    "--color-ring-primary": "#2c84db",
    "--border-radius-md": "8px",
    "--border-radius-lg": "12px",
  },
  dark: {
    "--color-background-primary": "#30302e",
    "--color-background-secondary": "#262624",
    "--color-background-tertiary": "#3a3936",
    "--color-text-primary": "#f5f4ef",
    "--color-text-secondary": "#a8a69d",
    "--color-border-primary": "rgba(222, 220, 209, 0.26)",
    "--color-border-secondary": "rgba(222, 220, 209, 0.13)",
    "--color-ring-primary": "#5ea2ec",
    "--color-text-danger": "#f08a77",
    "--color-text-success": "#7cc79a",
    "--border-radius-md": "8px",
    "--border-radius-lg": "12px",
  },
};

declare global {
  interface Window {
    __calls: Array<{ name: string; arguments: unknown }>;
    __links: string[];
    __ready: boolean;
    __lastPreview: unknown;
  }
}
window.__calls = [];
window.__links = [];
window.__ready = false;

document.documentElement.style.background = theme === "dark" ? "#262624" : "#faf9f5";
document.documentElement.style.colorScheme = theme;
const frame = document.getElementById("frame") as HTMLIFrameElement;
const wrap = document.getElementById("wrap") as HTMLDivElement;
wrap.style.width = `${width}px`;
// Hosts draw their own card around the iframe; emulate it so flush widgets are judged in context.
const card = CLAUDE_LIKE[theme];
wrap.style.border = `1px solid ${card["--color-border-secondary"]}`;
wrap.style.borderRadius = "12px";
wrap.style.background = card["--color-background-primary"] ?? "";
wrap.style.overflow = "hidden";

const never = () => new Promise<never>(() => {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const text = (t: string) => [{ type: "text" as const, text: t }];

async function main() {
  const hostContext: McpUiHostContext = {
    theme,
    displayMode: "inline",
    platform: "web",
    locale: "en-US",
    containerDimensions: { maxHeight: 2000, width },
    ...(q.get("styles") === "none" ? {} : { styles: { variables: CLAUDE_LIKE[theme] as McpUiStyles } }),
  };

  const bridge = new AppBridge(null, { name: "zernio-dev-host", version: "0.0.1" }, { openLinks: {}, serverTools: {}, updateModelContext: { text: {} } }, { hostContext });

  bridge.onsizechange = ({ height }) => {
    if (height) frame.style.height = `${Math.ceil(height)}px`;
  };
  bridge.onopenlink = async ({ url }) => {
    window.__links.push(url);
    return {};
  };
  bridge.onupdatemodelcontext = async () => ({});
  bridge.oncalltool = async (params) => {
    window.__calls.push({ name: params.name, arguments: structuredClone(params.arguments) });
    if (params.name === TOOL_NAMES.preview) {
      if (scenario === "edit-hang") return never();
      await sleep(350);
      if (scenario === "edit-error") return { isError: true, content: text("Zernio didn't answer in time. Try again.") };
      const r = await buildPreview(params.arguments as unknown as PreviewPostInput, FAKE_ACCOUNTS);
      return { structuredContent: r as unknown as Record<string, unknown>, content: text("Preview updated.") };
    }
    if (params.name === TOOL_NAMES.publish) {
      if (scenario === "publish-hang") return never();
      await sleep(600);
      if (scenario === "publish-error")
        return {
          isError: true,
          structuredContent: { error: "Zernio's validator rejected the post.", accountIds: ["acc_bluesky_01"], errors: ["Bluesky: the session expired, reconnect the account."] },
          content: text("Zernio's validator rejected the post."),
        };
      const args = params.arguments as unknown as PublishPostInput;
      const out = scenario === "publish-partial" ? partialPublishFixture(args) : publishFixture(args);
      return { structuredContent: out as unknown as Record<string, unknown>, content: text("Published.") };
    }
    return { isError: true, content: text(`Unknown tool ${params.name}`) };
  };

  bridge.oninitialized = async () => {
    window.__ready = true;
    if (widget === "preview-post") {
      const input = scenario === "nothing" ? { ...DEMO_INPUT, platforms: ["twitter", "instagram"] as PreviewPostInput["platforms"] } : DEMO_INPUT;
      if (scenario === "streaming") {
        await bridge.sendToolInputPartial({ arguments: { content: input.content.slice(0, 80), platforms: input.platforms.slice(0, 3) } });
        return;
      }
      await bridge.sendToolInput({ arguments: input as unknown as Record<string, unknown> });
      if (scenario === "loading") return;
      if (scenario === "cancelled") return bridge.sendToolCancelled({ reason: "user action" });
      if (scenario === "error") return bridge.sendToolResult({ isError: true, content: text("Couldn't reach Zernio to list your accounts (502). Try again in a moment.") });
      const r = await previewFixture(input);
      window.__lastPreview = r;
      await bridge.sendToolResult({ structuredContent: r as unknown as Record<string, unknown>, content: text("Preview ready.") });
    } else if (widget === "render-view") {
      const example = EXAMPLES.find((e) => e.id === (q.get("example") ?? "weekly-report")) ?? EXAMPLES[0]!;
      await bridge.sendToolInput({ arguments: { spec: example.spec } });
      if (scenario === "loading") return;
      if (scenario === "error")
        return bridge.sendToolResult({
          isError: true,
          structuredContent: renderViewErrorFixture,
          content: text(renderViewErrorFixture.error),
        });
      await bridge.sendToolResult({ structuredContent: { title: example.label, spec: example.spec }, content: text(example.label) });
    } else if (widget === "analytics") {
      await bridge.sendToolInput({ arguments: { days: 14 } });
      if (scenario === "loading") return;
      if (scenario === "error") return bridge.sendToolResult({ isError: true, content: text("Couldn't reach Zernio (502). Try again in a moment.") });
      if (scenario === "sample") return bridge.sendToolResult({ structuredContent: analyticsSampleFixture() as unknown as Record<string, unknown>, content: text("Sample analytics.") });
      if (scenario === "unavailable") return bridge.sendToolResult({ structuredContent: analyticsUnavailableFixture, content: text("Analytics unavailable.") });
      await bridge.sendToolResult({ structuredContent: analyticsFixture(14) as unknown as Record<string, unknown>, content: text("Analytics.") });
    } else {
      await bridge.sendToolInput({ arguments: {} });
      if (scenario === "loading") return;
      if (scenario === "error") return bridge.sendToolResult({ isError: true, content: text("Couldn't list accounts (401).") });
      await bridge.sendToolResult({ structuredContent: accountsFixture, content: text("Accounts.") });
    }
  };

  // Listen before the widget boots so its ui/initialize request is never missed.
  await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  const html = await fetch(`./${widget}.html`).then((r) => r.text());
  frame.srcdoc = html;
}

main().catch((e) => {
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:red">${String(e?.stack ?? e)}</pre>`);
});
