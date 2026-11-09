import { CatalogView } from "@zernio-elements/catalog";
import type { RenderViewResult } from "../types";
import { Bone, Header, Shell, Tag } from "../shared";

const FOOTER = "Built from Zernio Elements components · validated against the catalog";

function Footer({ text = FOOTER }: { text?: string }) {
  return <p className="border-t border-[var(--ze-border)] px-4 py-2.5 text-[11px] leading-4 text-[var(--ze-muted)]">{text}</p>;
}

function rootTitle(spec: unknown): string | undefined {
  const s = spec as { root?: unknown; elements?: Record<string, { props?: { title?: unknown } }> } | null;
  const t = typeof s?.root === "string" ? s.elements?.[s.root]?.props?.title : undefined;
  return typeof t === "string" ? t : undefined;
}

/** A json-render spec drawn only with catalog blocks (the model can't invent components). */
export function RenderView({ data }: { data: RenderViewResult }) {
  // Skip the title row when the spec's root block already shows the same title.
  const title = data.title && data.title.trim() !== rootTitle(data.spec)?.trim() ? data.title : undefined;
  const header = !!title || !!data.mock;
  return (
    <Shell>
      {header && <Header title={title ?? "View"} meta={data.mock ? <Tag tone="warning">Mock data</Tag> : undefined} />}
      <div className={header ? "border-t border-[var(--ze-border)] p-4" : "p-4"}>
        <CatalogView spec={data.spec} />
      </div>
      <Footer />
    </Shell>
  );
}

/** render_view refused the spec: { error, errors } shown calmly as a list. */
export function RenderViewError({ error, errors }: { error?: string; errors: string[] }) {
  return (
    <Shell>
      <div role="alert" className="flex flex-col gap-1.5 px-4 py-4">
        <p className="text-[13px] font-semibold">This view couldn't be rendered</p>
        {error && <p className="text-[12px] leading-[18px] text-[var(--ze-muted)]">{error}</p>}
        {errors.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-[12px] leading-[18px] text-[var(--ze-fg)]">
            {errors.slice(0, 10).map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--ze-danger)]" />
                <span className="min-w-0 break-words">{e}</span>
              </li>
            ))}
            {errors.length > 10 && <li className="text-[var(--ze-muted)]">and {errors.length - 10} more</li>}
          </ul>
        )}
      </div>
      <Footer text="Only tested Zernio Elements components can be rendered, so nothing was drawn" />
    </Shell>
  );
}

export function RenderViewSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Building the view" className="flex flex-col gap-3 p-4">
        <Bone className="h-4 w-48" />
        <Bone className="h-3 w-72 max-w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Bone className="h-16" />
          <Bone className="h-16" />
        </div>
        <Bone className="h-28" />
      </div>
    </Shell>
  );
}
