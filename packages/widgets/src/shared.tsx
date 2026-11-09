import type { ReactNode } from "react";
import { cn } from "@zernio-elements/react";

/**
 * The widget root. Flush: the host (e.g. Claude) already draws the card around the iframe, so no
 * outer border, radius, background or margin here; sections keep their own hairline dividers.
 */
export function Shell({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div style={style} className={cn("ze-root text-[var(--ze-fg)] [font-family:var(--ze-font)]", className)}>
      {children}
    </div>
  );
}

export function Header({ title, meta, children }: { title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
      <div className="min-w-0">
        <h1 className="text-[14px] leading-5 font-semibold tracking-[-0.005em]">{title}</h1>
        {children && <div className="mt-0.5 text-[12px] leading-[18px] text-[var(--ze-muted)]">{children}</div>}
      </div>
      {meta && <div className="flex shrink-0 items-center gap-2 pt-px">{meta}</div>}
    </div>
  );
}

/** Small uppercase-free tag. "Mock data" and similar quiet facts. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[5px] border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap",
        tone === "warning" ? "border-[color-mix(in_srgb,var(--ze-warning)_40%,transparent)] text-[var(--ze-warning)]" : "border-[var(--ze-border)] text-[var(--ze-muted)]",
      )}
    >
      {children}
    </span>
  );
}

export type Tone = "success" | "neutral" | "danger" | "warning";

const DOT: Record<Tone, string> = {
  success: "bg-[var(--ze-success)]",
  danger: "bg-[var(--ze-danger)]",
  warning: "bg-[var(--ze-warning)]",
  neutral: "border border-[var(--ze-muted)] bg-transparent",
};

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-[7px] shrink-0 rounded-full", DOT[tone], className)} />;
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-[var(--ze-success)]",
  danger: "text-[var(--ze-danger)]",
  warning: "text-[var(--ze-warning)]",
  neutral: "text-[var(--ze-muted)]",
};

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent motion-reduce:animate-none", className)}
    />
  );
}

/** Calm inline message used for errors, cancellations and empty states. */
export function Message({ title, children, action, tone = "neutral" }: { title: string; children?: ReactNode; action?: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <div role={tone === "danger" ? "alert" : undefined} className="flex flex-col items-start gap-1 px-4 py-4">
      <p className={cn("text-[13px] font-semibold", tone === "danger" && "text-[var(--ze-danger)]")}>{title}</p>
      {children && <div className="max-w-prose text-[12px] leading-[18px] text-[var(--ze-muted)]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden style={style} className={cn("animate-pulse rounded-[5px] bg-[var(--ze-fill)] motion-reduce:animate-none", className)} />;
}

export const fmtNumber = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : n.toLocaleString("en-US"));

export const listJoin = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
