"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NAV } from "@/lib/catalog";

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-7 text-[14px]">
      {NAV.map((group) => (
        <div key={group.title}>
          <h4 className="mb-2 px-2 text-[12px] font-medium tracking-wide text-muted">{group.title}</h4>
          <ul className="space-y-px">
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "block rounded-md bg-subtle px-2 py-1.5 font-medium text-fg"
                        : "block rounded-md px-2 py-1.5 text-fg-2 transition-colors hover:bg-subtle hover:text-fg"
                    }
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SiteShell({ children, demoUrl }: { children: ReactNode; demoUrl?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 md:px-6">
          <button
            type="button"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-fg hover:bg-subtle md:hidden"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {open ? (
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight">Zernio Elements</span>
            <span className="hidden font-mono text-[11px] text-muted sm:inline">v0.0.1</span>
          </Link>
          <nav aria-label="Site" className="ml-auto flex items-center gap-1 text-[13px] text-fg-2">
            <Link href="/components/composer" className="hidden rounded-md px-2.5 py-1.5 hover:text-fg sm:inline-block">
              Components
            </Link>
            <a href="/r/registry.json" className="hidden rounded-md px-2.5 py-1.5 hover:text-fg sm:inline-block">
              Registry
            </a>
            <a href="/llms.txt" className="rounded-md px-2.5 py-1.5 font-mono text-[12px] hover:text-fg">
              llms.txt
            </a>
            {demoUrl && (
              <a href={demoUrl} className="ml-1 rounded-md border border-line px-3 py-1.5 font-medium text-fg hover:border-line-strong">
                Demo
              </a>
            )}
          </nav>
        </div>
      </header>

      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-14 z-20 overflow-y-auto bg-bg px-4 py-6 md:hidden">
          <Nav onNavigate={() => setOpen(false)} />
        </div>
      )}

      <div className="mx-auto flex max-w-[1440px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[248px] shrink-0 overflow-y-auto border-r border-line px-4 py-8 md:block">
          <Nav />
        </aside>
        <main id="content" className="min-w-0 flex-1 px-4 pb-24 pt-8 md:px-10 md:pt-12 lg:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
