import type { ReactNode } from "react";
import type { PropDef } from "@/lib/catalog";

/** Page primitives: one type scale, one spacing rhythm, used by every page. */

export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: ReactNode }) {
  return (
    <header className="mb-10 max-w-[680px]">
      {eyebrow && <p className="mb-3 text-[13px] font-medium text-muted">{eyebrow}</p>}
      <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-fg md:text-[34px]">{title}</h1>
      <p className="mt-3 text-[16px] leading-[1.6] text-fg-2 md:text-[17px]">{description}</p>
    </header>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  const anchor = id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section id={anchor} className="mt-14 scroll-mt-20 first:mt-0">
      <h2 className="mb-4 text-[20px] font-semibold tracking-[-0.01em] text-fg">
        <a href={`#${anchor}`} className="hover:underline hover:decoration-line-strong hover:underline-offset-4">
          {title}
        </a>
      </h2>
      <div className="prose-docs space-y-4 text-[15px]">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-[15px] font-semibold text-fg">{children}</h3>;
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line bg-subtle">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3.5 py-2.5 font-medium text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-3.5 py-2.5 leading-relaxed text-fg-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Mono = ({ children, strong }: { children: ReactNode; strong?: boolean }) => (
  <code className={`whitespace-nowrap font-mono text-[12.5px] ${strong ? "text-fg" : "text-fg-2"}`}>{children}</code>
);

export function PropsTable({ props, emptyText = "No props. Data comes from the hooks inside ZernioProvider." }: { props: PropDef[]; emptyText?: string }) {
  if (!props.length) return <p className="text-[14px] text-muted">{emptyText}</p>;
  return (
    <Table
      head={["Prop", "Type", "Default", "Description"]}
      rows={props.map((p) => [
        <Mono key="n" strong>
          {p.name}
          {p.required ? <span className="text-accent">*</span> : null}
        </Mono>,
        <code key="t" className="font-mono text-[12.5px] text-fg-2">
          {p.type}
        </code>,
        p.default ? <Mono key="d">{p.default}</Mono> : <span key="d" className="text-muted">-</span>,
        p.description,
      ])}
    />
  );
}

export function Callout({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-subtle px-4 py-3 text-[14px] leading-relaxed text-fg-2">{children}</div>;
}
