"use client";

import * as Elements from "@zernio-elements/react";
import { ZernioProvider } from "@zernio-elements/react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { COMPONENTS, THEMES, type ThemeName } from "@/lib/catalog";
import { CUSTOM_PREVIEWS } from "./previews";

/** Runs inside the preview iframe: provider + theme scope + height reporting to the parent page. */
export function PreviewHost({ slug, initialTheme }: { slug: string; initialTheme: ThemeName }) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; theme?: string };
      if (d?.type === "ze-preview-theme" && THEMES.includes(d.theme as ThemeName)) setTheme(d.theme as ThemeName);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || window.parent === window) return;
    const post = () => window.parent.postMessage({ type: "ze-preview-height", height: el.offsetHeight }, window.location.origin);
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} data-ze-theme={theme} className="bg-[var(--ze-surface)] p-4 text-[var(--ze-fg)] [font-family:var(--ze-font)] sm:p-8">
      <ZernioProvider>{renderPreview(slug)}</ZernioProvider>
    </div>
  );
}

function renderPreview(slug: string): ReactNode {
  const custom = CUSTOM_PREVIEWS[slug];
  if (custom) return custom();
  const doc = COMPONENTS.find((c) => c.slug === slug);
  const C = doc ? (Elements as unknown as Record<string, ComponentType<Record<string, unknown>>>)[doc.name] : undefined;
  if (!C) return <p className="text-sm text-[var(--ze-muted)]">No preview for {slug}.</p>;
  return <C {...(doc?.previewProps ?? {})} />;
}
