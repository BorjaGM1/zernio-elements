"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
      className={`inline-flex h-7 items-center rounded-md border border-line bg-bg px-2 text-[12px] text-fg-2 transition-colors hover:border-line-strong hover:text-fg ${className}`}
      aria-label={done ? "Copied" : label}
    >
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
