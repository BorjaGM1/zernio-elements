"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Analytics, Calendar, Composer, ConnectAccounts, Inbox, ZernioProvider, cn, useComposer } from "@zernio-elements/react";
import { BRANDS, type Brand } from "@/lib/brands";

const TABS = ["Compose", "Calendar", "Inbox", "Analytics", "Accounts"] as const;
type Tab = (typeof TABS)[number];

function Suite({ brand, tab }: { brand: Brand; tab: Tab }) {
  // key={brand.id} on the parent resets the draft per brand
  const composer = useComposer({ content: brand.draft, media: [{ url: brand.media.url, type: "image", width: brand.media.width, height: brand.media.height }] });
  return (
    <>
      {/* Keep the composer mounted so switching tabs never loses the draft. */}
      <div hidden={tab !== "Compose"}>
        <Composer controller={composer} author={brand.author} previewWithoutAccount={["twitter", "instagram", "youtube", "linkedin", "threads"]} />
      </div>
      {tab === "Calendar" && <Calendar />}
      {tab === "Inbox" && <Inbox />}
      {tab === "Analytics" && <Analytics />}
      {tab === "Accounts" && <ConnectAccounts branding={{ brandName: brand.name, primaryColor: brand.connectColor }} />}
    </>
  );
}

export function Demo() {
  const [brandId, setBrandId] = useState<Brand["id"]>("hostly");
  const [tab, setTab] = useState<Tab>("Compose");
  const brand = BRANDS.find((b) => b.id === brandId)!;

  // Deep links: /?brand=ferment&tab=Inbox
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const b = BRANDS.find((x) => x.id === q.get("brand"));
    const t = TABS.find((x) => x.toLowerCase() === q.get("tab")?.toLowerCase());
    if (b) setBrandId(b.id);
    if (t) setTab(t);
  }, []);

  const Shell = SHELLS[brand.id];
  return (
    <div data-ze-theme={brand.id} className="flex min-h-screen flex-col bg-[var(--ze-surface)] text-[var(--ze-fg)] [font-family:var(--ze-font)]">
      <DemoBar brandId={brand.id} onBrand={setBrandId} />
      <ZernioProvider key={brand.id}>
        <Shell brand={brand} tab={tab} onTab={setTab}>
          <Suite brand={brand} tab={tab} />
        </Shell>
      </ZernioProvider>
    </div>
  );
}

/** Outside the products: the demo's own control strip. Deliberately neutral so it never reads as part of a brand. */
function DemoBar({ brandId, onBrand }: { brandId: Brand["id"]; onBrand: (id: Brand["id"]) => void }) {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/demo/mode")
      .then((r) => r.json())
      .then((d: { live: boolean }) => setLive(d.live))
      .catch(() => setLive(false));
  }, []);
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-4 bg-[#111] px-4 font-[system-ui] text-[12px] text-[#bbb]">
      <div className="flex items-center gap-3">
        <span className="font-semibold whitespace-nowrap text-white">Zernio Elements</span>
        <span className="hidden text-[#777] sm:inline">Same components, three products</span>
      </div>
      <div className="flex items-center gap-1" role="tablist" aria-label="Product">
        {BRANDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={b.id === brandId}
            onClick={() => onBrand(b.id)}
            className={cn("rounded px-2.5 py-1 transition-colors", b.id === brandId ? "bg-white text-black" : "hover:text-white")}
          >
            {b.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-[#4ade80]" : "bg-[#777]")} />
          <span className="hidden sm:inline">{live === null ? "" : live ? "Live · real accounts" : "Demo data"}</span>
        </span>
        <a href="/six-lines" className="hidden underline-offset-2 hover:text-white hover:underline md:inline">
          The code
        </a>
        <a href="/compose" className="hidden underline-offset-2 hover:text-white hover:underline md:inline">
          Compose
        </a>
      </div>
    </div>
  );
}

type ShellProps = { brand: Brand; tab: Tab; onTab: (t: Tab) => void; children: ReactNode };

/* Hostly: a sidebar product. Social is one module among reservations and cleaning. */
function HostlyShell({ brand, tab, onTab, children }: ShellProps) {
  return (
    <div className="flex flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--ze-border)] bg-[var(--ze-bg)] px-4 py-5 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--ze-primary)] text-sm font-bold text-white">h</span>
          <span className="text-[17px] font-semibold tracking-tight">{brand.name}</span>
        </div>
        <div className="mt-6 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] px-3 py-2.5">
          <div className="text-sm font-medium">{brand.customer}</div>
          <div className="text-xs text-[var(--ze-muted)]">{brand.location}</div>
        </div>
        <nav className="mt-6 flex flex-col gap-0.5" aria-label="Hostly">
          {brand.nav.map((n) => (
            <span
              key={n}
              aria-current={n === brand.socialLabel ? "page" : undefined}
              className={cn(
                "rounded-[var(--ze-radius-sm)] px-3 py-2 text-sm",
                n === brand.socialLabel ? "bg-[var(--ze-surface)] font-semibold text-[var(--ze-fg)]" : "text-[var(--ze-muted)]",
              )}
            >
              {n}
            </span>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-[var(--ze-muted)]">Signed in as Elena · Owner</div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1280px]">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--ze-muted)]">{brand.customer}</p>
              <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Social</h1>
            </div>
            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-[12px] bg-[var(--ze-fill)] p-1" aria-label="Social">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => onTab(t)}
                  aria-current={t === tab ? "page" : undefined}
                  className={cn("rounded-[9px] px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors", t === tab ? "bg-[var(--ze-bg)] font-semibold shadow-sm" : "text-[var(--ze-muted)] hover:text-[var(--ze-fg)]")}
                >
                  {t}
                </button>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

/* Ferment: a top-bar product with an editorial serif voice. Marketing lives next to the floor plan. */
function FermentShell({ brand, tab, onTab, children }: ShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-[var(--ze-border)] bg-[var(--ze-surface)]">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-10 px-6">
          <span className="font-[family-name:var(--font-newsreader)] text-[26px] italic">{brand.name}</span>
          <nav className="hidden gap-7 text-[13px] md:flex" aria-label="Ferment">
            {brand.nav.map((n) => (
              <span key={n} className={n === brand.socialLabel ? "text-[var(--ze-primary)]" : "text-[var(--ze-muted)]"}>
                {n}
              </span>
            ))}
          </nav>
          <span className="ml-auto text-[13px] text-[var(--ze-muted)]">
            {brand.customer}, {brand.location}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ze-border)]">
          <div className="pb-5">
            <p className="mb-1 text-[11px] tracking-[0.18em] text-[var(--ze-muted)] uppercase">Marketing</p>
            <h1 className="font-[family-name:var(--font-newsreader)] text-[40px] leading-none">Social & guests</h1>
          </div>
          <nav className="flex max-w-full gap-6 overflow-x-auto" aria-label="Marketing">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => onTab(t)}
                aria-current={t === tab ? "page" : undefined}
                className={cn("-mb-px border-b pb-4 text-[13px] whitespace-nowrap transition-colors", t === tab ? "border-[var(--ze-primary)] text-[var(--ze-fg)]" : "border-transparent text-[var(--ze-muted)] hover:text-[var(--ze-fg)]")}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        {children}
      </main>
    </div>
  );
}

/* Liftly: dense, high-contrast, built for the front desk. */
function LiftlyShell({ brand, tab, onTab, children }: ShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-[#0b0b0b] text-white">
        <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-8 px-5">
          <span className="text-[22px] font-black tracking-tight uppercase [font-stretch:75%]">
            Lift<span className="text-[#d4ff3a]">ly</span>
          </span>
          <nav className="hidden h-14 items-stretch text-[12px] font-bold tracking-[0.06em] uppercase md:flex" aria-label="Liftly">
            {brand.nav.map((n) => (
              <span key={n} className={cn("flex items-center px-3", n === brand.socialLabel ? "bg-[#d4ff3a] text-black" : "text-[#9a9a94]")}>
                {n}
              </span>
            ))}
          </nav>
          <span className="ml-auto font-[family-name:var(--font-jetbrains)] text-[11px] text-[#9a9a94] uppercase">
            {brand.customer} / {brand.location}
          </span>
        </div>
      </header>
      <div className="border-b-2 border-[#0b0b0b] bg-[var(--ze-bg)]">
        <div className="mx-auto flex max-w-[1360px] items-stretch gap-0 overflow-x-auto px-5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => onTab(t)}
              aria-current={t === tab ? "page" : undefined}
              className={cn(
                "border-r border-[var(--ze-border)] px-5 py-3 text-[12px] font-bold tracking-[0.06em] whitespace-nowrap uppercase first:border-l",
                t === tab ? "bg-[#0b0b0b] text-[#d4ff3a]" : "hover:bg-[var(--ze-fill)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-5 py-6">{children}</main>
    </div>
  );
}

const SHELLS: Record<Brand["id"], (p: ShellProps) => ReactNode> = {
  hostly: HostlyShell,
  ferment: FermentShell,
  liftly: LiftlyShell,
};
