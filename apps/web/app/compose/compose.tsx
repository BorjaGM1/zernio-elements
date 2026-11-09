"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CatalogView, EXAMPLES, catalog, parseSpecText, validateCatalogSpec, type CatalogExample } from "@zernio-elements/catalog";
import { Button, FOCUS, INPUT_FOCUS, Notice, Skeleton, cn } from "@zernio-elements/react";

const THEMES = [
  { id: "default", name: "Default" },
  { id: "hostly", name: "Hostly" },
  { id: "ferment", name: "Ferment" },
  { id: "liftly", name: "Liftly" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];

type Source = { kind: "example"; example: CatalogExample } | { kind: "model"; prompt: string };
type Status = "idle" | "streaming" | "done" | "error";

export function Compose({ model }: { model: string | null }) {
  const [theme, setTheme] = useState<ThemeId>("default");
  const [prompt, setPrompt] = useState(EXAMPLES[0]!.prompt);
  const [source, setSource] = useState<Source>({ kind: "example", example: EXAMPLES[0]! });
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<Status>("done");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Deep links for screenshots: /compose?example=account-health&theme=ferment
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ex = EXAMPLES.find((e) => e.id === q.get("example"));
    const th = THEMES.find((t) => t.id === q.get("theme"));
    if (ex) loadExample(ex);
    if (th) setTheme(th.id);
  }, []);

  function loadExample(e: CatalogExample) {
    abort.current?.abort();
    setPrompt(e.prompt);
    setSource({ kind: "example", example: e });
    setRaw("");
    setError(null);
    setStatus("done");
  }

  async function generate() {
    if (!model || !prompt.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSource({ kind: "model", prompt });
    setRaw("");
    setError(null);
    setStatus("streaming");
    try {
      const res = await fetch("/api/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `The model route returned ${res.status}.`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setRaw(text);
      }
      setRaw(text + decoder.decode());
      setStatus("done");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  // The spec on screen: the example as-is, or the model's stream compiled so far.
  // While streaming only complete lines count; once done, the last line does too.
  const spec = useMemo(
    () => (source.kind === "example" ? source.example.spec : parseSpecText(status === "streaming" || raw.endsWith("\n") ? raw : raw + "\n")),
    [source, raw, status],
  );
  // Validated only once complete: a half-streamed spec is expected to be incomplete.
  const check = useMemo(() => (status === "streaming" ? null : validateCatalogSpec(spec)), [spec, status]);
  const elementCount = Object.keys(spec.elements ?? {}).length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f5] text-[#111] [font-family:system-ui]">
      <TopBar />
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)]">
        {/* Left: the agent's side. Neutral, outside any brand. */}
        <aside className="flex min-w-0 flex-col gap-6 border-[#e4e4e1] bg-white px-5 py-6 lg:border-r lg:px-6">
          <header>
            <h1 className="text-[22px] leading-tight font-semibold tracking-tight">Compose a view</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6b6b68]">
              An agent writes a JSON spec. json-render checks it against a catalog of {catalog.componentNames.length} tested components and renders the real ones. Anything outside the catalog is rejected, never drawn.
            </p>
          </header>

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            <label htmlFor="compose-prompt" className="text-xs font-medium">
              Ask for a view
            </label>
            <textarea
              id="compose-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={1000}
              className={cn(INPUT_FOCUS, "w-full resize-y rounded-[6px] border border-[#c9c9c5] bg-white px-3 py-2 text-[13px] leading-relaxed")}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] leading-snug text-[#6b6b68]">
                {model ? (
                  <>Model: {model}</>
                ) : (
                  <>
                    No model configured. Set <code className="font-mono">ANTHROPIC_API_KEY</code> or <code className="font-mono">AI_GATEWAY_API_KEY</code> to generate.
                  </>
                )}
              </span>
              <span className="flex shrink-0 gap-2">
                {status === "streaming" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      abort.current?.abort();
                      setStatus("done");
                    }}
                  >
                    Stop
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={!model || !prompt.trim() || status === "streaming"} title={model ? undefined : "No model configured"}>
                  {status === "streaming" ? "Generating" : "Generate"}
                </Button>
              </span>
            </div>
          </form>

          <section aria-labelledby="examples-h" className="flex flex-col gap-2">
            <h2 id="examples-h" className="text-xs font-medium">
              Examples
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-[8px] border border-[#e4e4e1]">
              {EXAMPLES.map((e) => {
                const active = source.kind === "example" && source.example.id === e.id;
                return (
                  <li key={e.id} className="border-t border-[#e4e4e1] first:border-t-0">
                    <button
                      type="button"
                      onClick={() => loadExample(e)}
                      aria-pressed={active}
                      className={cn(FOCUS, "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors", active ? "bg-[#efefed]" : "hover:bg-[#f6f6f5]")}
                    >
                      <span className="text-[13px] font-medium">{e.label}</span>
                      <span className="text-xs leading-snug text-[#6b6b68]">{e.prompt}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <details open className="group flex min-h-0 flex-col">
            <summary className={cn(FOCUS, "flex cursor-pointer list-none items-center justify-between gap-3 rounded-[4px] py-1 text-xs font-medium")}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block w-2 text-[#6b6b68] transition-transform group-open:rotate-90">
                  ›
                </span>
                Spec
              </span>
              <SpecStatus status={status} ok={check ? check.ok : null} count={elementCount} />
            </summary>
            <p className="mt-1 pl-4 text-[11px] text-[#6b6b68]">
              {source.kind === "example" ? (model ? "Example spec (pre-built)" : "Example spec (no model configured)") : "Generated by the model, validated before rendering"}
            </p>
            {check && !check.ok && (
              <ul className="mt-2 flex flex-col gap-0.5 rounded-[6px] border border-[#c4321f]/30 bg-[#c4321f]/5 px-3 py-2 text-[11px] text-[#c4321f]">
                {check.errors.slice(0, 12).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <pre className="mt-2 max-h-[46vh] overflow-auto rounded-[6px] border border-[#e4e4e1] bg-[#fafaf9] p-3 font-mono text-[11px] leading-[1.55] whitespace-pre text-[#333]" aria-label="JSON spec, read only" tabIndex={0}>
              {elementCount ? JSON.stringify(spec, null, 2) : raw || (status === "streaming" ? "Waiting for the first patch" : "")}
            </pre>
          </details>
        </aside>

        {/* Right: the product's side. The same spec, rendered inside a brand theme. */}
        <section className="flex min-w-0 flex-col">
          <div className="flex h-12 items-center justify-between gap-3 border-b border-[#e4e4e1] bg-white px-5 lg:px-8">
            <span className="text-xs text-[#6b6b68]">Rendered with @zernio-elements/react</span>
            <div className="flex gap-0.5 rounded-[7px] bg-[#efefed] p-0.5" role="radiogroup" aria-label="Theme">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(FOCUS, "rounded-[5px] px-2.5 py-1 text-xs transition-colors", theme === t.id ? "bg-white font-medium shadow-[0_1px_1px_rgb(0_0_0/0.06)]" : "text-[#6b6b68] hover:text-[#111]")}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div data-ze-theme={theme} className="flex-1 bg-[var(--ze-surface)] px-5 py-8 text-[var(--ze-fg)] [font-family:var(--ze-font)] lg:px-10">
            <div className="mx-auto max-w-[980px]">
              {status === "error" ? (
                <Notice tone="danger" title="Couldn't generate a view">
                  {error}
                </Notice>
              ) : status === "streaming" ? (
                <div className="flex flex-col gap-4" aria-busy aria-label="Generating">
                  <p className="text-sm text-[var(--ze-muted)]">{elementCount ? `Composing, ${elementCount} element${elementCount === 1 ? "" : "s"} so far` : "Composing"}</p>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-56" />
                </div>
              ) : source.kind === "model" && !raw ? (
                <Notice title="Nothing came back">The model returned an empty response.</Notice>
              ) : (
                // CatalogView validates again and shows the errors instead of rendering an invalid spec.
                <CatalogView spec={spec} />
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SpecStatus({ status, ok, count }: { status: Status; ok: boolean | null; count: number }) {
  if (status === "streaming") return <span className="font-normal text-[#6b6b68] tabular-nums">Streaming · {count}</span>;
  if (ok === null) return null;
  return (
    <span className={cn("flex items-center gap-1.5 font-normal tabular-nums", ok ? "text-[#1f7a4d]" : "text-[#c4321f]")}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-[#1f7a4d]" : "bg-[#c4321f]")} />
      {ok ? `Valid · ${count} elements` : "Rejected by the catalog"}
    </span>
  );
}

function TopBar() {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-4 bg-[#111] px-4 text-[12px] text-[#bbb]">
      <div className="flex items-center gap-3">
        <a href="/" className="font-semibold whitespace-nowrap text-white">
          Zernio Elements
        </a>
        <span className="hidden text-[#777] sm:inline">Generative UI, only from tested components</span>
      </div>
      <nav className="flex items-center gap-4">
        <a href="/" className="underline-offset-2 hover:text-white hover:underline">
          Embedded demo
        </a>
        <a href="/six-lines" className="underline-offset-2 hover:text-white hover:underline">
          The code
        </a>
      </nav>
    </div>
  );
}
