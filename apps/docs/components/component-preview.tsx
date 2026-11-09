"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { THEMES, type ThemeName } from "@/lib/catalog";

/**
 * Preview / Code tabs. The live preview runs in a same-origin iframe (/preview/<slug>) so the
 * component's own responsive breakpoints respond to the frame width, not the browser window.
 */
export function ComponentPreview({ slug, code }: { slug: string; code: ReactNode }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [theme, setTheme] = useState<ThemeName>("default");
  const [height, setHeight] = useState(360);
  const frame = useRef<HTMLIFrameElement>(null);
  const id = useId();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { type?: string; height?: number };
      if (d?.type === "ze-preview-height" && typeof d.height === "number") setHeight(Math.max(160, Math.ceil(d.height)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "ze-preview-theme", theme }, window.location.origin);
  }, [theme]);

  const tabCls = (on: boolean) =>
    `relative h-10 px-1 text-[13px] font-medium transition-colors ${on ? "text-fg" : "text-muted hover:text-fg"}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-4 border-b border-line">
        <div role="tablist" aria-label="Preview or code" className="flex gap-5">
          {(["preview", "code"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`${id}-${t}-tab`}
              aria-selected={tab === t}
              aria-controls={`${id}-${t}`}
              onClick={() => setTab(t)}
              className={tabCls(tab === t)}
            >
              {t === "preview" ? "Preview" : "Code"}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-px bg-fg" />}
            </button>
          ))}
        </div>
        {tab === "preview" && (
          <div role="radiogroup" aria-label="Preview theme" className="mb-1.5 flex items-center gap-0.5 rounded-md border border-line p-0.5">
            {THEMES.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={theme === t}
                onClick={() => setTheme(t)}
                className={`h-6 rounded-[4px] px-2 text-[12px] capitalize transition-colors ${
                  theme === t ? "bg-subtle font-medium text-fg shadow-[inset_0_0_0_1px_var(--d-line)]" : "text-muted hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div id={`${id}-preview`} role="tabpanel" aria-labelledby={`${id}-preview-tab`} hidden={tab !== "preview"} className="mt-4">
        <div className="overflow-hidden rounded-lg border border-line">
          <iframe
            ref={frame}
            src={`/preview/${slug}`}
            title={`${slug} live preview`}
            onLoad={() => frame.current?.contentWindow?.postMessage({ type: "ze-preview-theme", theme }, window.location.origin)}
            className="block w-full border-0 bg-transparent"
            style={{ height }}
          />
        </div>
      </div>
      <div id={`${id}-code`} role="tabpanel" aria-labelledby={`${id}-code-tab`} hidden={tab !== "code"} className="mt-4">
        {code}
      </div>
    </div>
  );
}
