/**
 * The only door to the outside world. Widgets never fetch: they receive the tool input/result from the
 * host and ask the host to call MCP tools (callServerTool) or open links (openLink) on their behalf.
 */
import { useCallback, useEffect, useState } from "react";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";

type ToolResult = Awaited<ReturnType<App["callServerTool"]>>;

export class ToolError extends Error {}

/** structuredContent of a tool result, or a ToolError carrying the tool's own text. */
export function unwrapResult(r: ToolResult): unknown {
  if (r.isError) throw new ToolError(errorText(r));
  if (r.structuredContent !== undefined) return r.structuredContent;
  // Hosts that drop structuredContent: fall back to a JSON text block.
  for (const c of r.content ?? []) {
    if (c.type === "text") {
      try {
        return JSON.parse(c.text);
      } catch {}
    }
  }
  throw new ToolError(resultText(r) || "The tool returned no data.");
}

/** A refusal's message: structuredContent { error | message, errors? } first, then the text content. */
export function errorText(r: ToolResult): string {
  const sc = (r.structuredContent ?? {}) as { error?: unknown; message?: unknown; errors?: unknown };
  const head = typeof sc.message === "string" ? sc.message : typeof sc.error === "string" ? sc.error : "";
  const details = (Array.isArray(sc.errors) ? sc.errors : [])
    .map((e) => (typeof e === "string" ? e : e && typeof e === "object" ? String((e as Record<string, unknown>).message ?? (e as Record<string, unknown>).error ?? "") : ""))
    .filter((e) => e && e !== head);
  const msg = [head, ...details].filter(Boolean).join(" ");
  return msg || resultText(r) || "The tool returned an error.";
}

export const resultText = (r: ToolResult) =>
  (r.content ?? [])
    .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

/** What a widget needs from the host. Pure interface so components are testable without a bridge. */
export interface HostActions {
  /** Calls an MCP tool through the host and returns its structuredContent. Throws ToolError on isError. */
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  openLink: (url: string) => Promise<void>;
  /** Tells the model what happened in the widget (best effort, ignored when unsupported). */
  tellModel: (text: string) => void;
}

export interface WidgetState {
  connected: boolean;
  connectError: Error | null;
  /** Arguments of the tool call that opened this widget (partial while streaming). */
  input: Record<string, unknown> | null;
  inputPartial: boolean;
  /** structuredContent of the tool result, once it arrives. */
  result: unknown;
  resultError: string | null;
  /** structuredContent of an isError result (e.g. render_view's { error, errors }), when present. */
  resultErrorData: unknown;
  cancelled: boolean;
  host: McpUiHostContext | undefined;
  actions: HostActions;
}

export function useWidget(name: string): WidgetState {
  const [input, setInput] = useState<Record<string, unknown> | null>(null);
  const [inputPartial, setInputPartial] = useState(false);
  const [result, setResult] = useState<unknown>(undefined);
  const [resultError, setResultError] = useState<string | null>(null);
  const [resultErrorData, setResultErrorData] = useState<unknown>(undefined);
  const [cancelled, setCancelled] = useState(false);
  const [host, setHost] = useState<McpUiHostContext | undefined>(undefined);

  const { app, isConnected, error } = useApp({
    appInfo: { name: `zernio-elements/${name}`, version: "0.0.1" },
    capabilities: {},
    onAppCreated: (a) => {
      // Registered before connect() so nothing sent right after the handshake is missed.
      a.ontoolinputpartial = (p) => {
        setInput(p.arguments ?? {});
        setInputPartial(true);
      };
      a.ontoolinput = (p) => {
        setInput(p.arguments ?? {});
        setInputPartial(false);
      };
      a.ontoolresult = (r) => {
        try {
          setResult(unwrapResult(r));
          setResultError(null);
          setResultErrorData(undefined);
        } catch (e) {
          setResultError(e instanceof Error ? e.message : String(e));
          setResultErrorData(r.structuredContent);
        }
      };
      a.ontoolcancelled = () => setCancelled(true);
      a.onhostcontextchanged = (ctx) => setHost((prev) => ({ ...prev, ...ctx }));
    },
  });

  useEffect(() => {
    if (app) setHost((prev) => ({ ...app.getHostContext(), ...prev }));
  }, [app]);

  // Theme (data-theme + color-scheme), host CSS variables and host fonts, mapped to --ze-* in styles.css.
  useHostStyles(app, app?.getHostContext());

  const callTool = useCallback(
    async (toolName: string, args: Record<string, unknown>) => {
      if (!app) throw new ToolError("Not connected to the host yet.");
      return unwrapResult(await app.callServerTool({ name: toolName, arguments: args }));
    },
    [app],
  );

  const openLink = useCallback(
    async (url: string) => {
      if (!app) return;
      const r = await app.openLink({ url });
      if (r.isError) throw new ToolError("The host didn't open the link.");
    },
    [app],
  );

  const tellModel = useCallback(
    (text: string) => {
      if (!app?.getHostCapabilities()?.updateModelContext) return;
      app.updateModelContext({ content: [{ type: "text", text }] }).catch(() => {});
    },
    [app],
  );

  return {
    connected: isConnected,
    connectError: error,
    input,
    inputPartial,
    result,
    resultError,
    resultErrorData,
    cancelled,
    host,
    actions: { callTool, openLink, tellModel },
  };
}

/** Safe-area padding (mobile hosts) applied to the widget root. */
export function safeAreaStyle(host: McpUiHostContext | undefined): React.CSSProperties | undefined {
  const s = host?.safeAreaInsets;
  if (!s) return undefined;
  return { paddingTop: s.top, paddingRight: s.right, paddingBottom: s.bottom, paddingLeft: s.left };
}
