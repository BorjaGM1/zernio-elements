import Link from "next/link";
import { NAV } from "@/lib/catalog";

/** Previous / next links, in sidebar order. */
export function PagerNav({ href }: { href: string }) {
  const flat = NAV.flatMap((g) => g.items);
  const i = flat.findIndex((x) => x.href === href);
  const prev = i > 0 ? flat[i - 1] : undefined;
  const next = i >= 0 && i < flat.length - 1 ? flat[i + 1] : undefined;
  const cls = "group flex min-w-0 flex-col gap-1 rounded-lg border border-line px-4 py-3 transition-colors hover:border-line-strong";
  return (
    <nav aria-label="Pagination" className="mt-16 grid grid-cols-2 gap-3 border-t border-line pt-8">
      {prev ? (
        <Link href={prev.href} className={cls}>
          <span className="text-[12px] text-muted">Previous</span>
          <span className="truncate text-[14px] font-medium text-fg">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className={`${cls} text-right`}>
          <span className="text-[12px] text-muted">Next</span>
          <span className="truncate text-[14px] font-medium text-fg">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
