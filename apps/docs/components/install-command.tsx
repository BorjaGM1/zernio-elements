"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "./copy-button";

const noop = () => () => {};
const ENV_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

/** The origin the visitor is on, so the command works on previews and production alike. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => ENV_ORIGIN || window.location.origin,
    () => ENV_ORIGIN || "http://localhost:3001",
  );
}

export function InstallCommand({ name }: { name: string }) {
  const origin = useOrigin();
  const cmd = `npx shadcn@latest add ${origin}/r/${name}.json`;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-code py-2 pl-4 pr-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] leading-7 text-fg [scrollbar-width:none]">
        <span className="select-none text-muted">$ </span>
        {cmd}
      </code>
      <CopyButton text={cmd} />
    </div>
  );
}

export function SiteUrl({ path = "" }: { path?: string }) {
  const origin = useOrigin();
  return <>{`${origin}${path}`}</>;
}
