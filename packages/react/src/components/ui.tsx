"use client";

import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { SPECS, type PlatformId } from "@zernio-elements/rules";
import { ZernioError } from "../provider";

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/*
 * Styles live in Tailwind classes, not in a stylesheet, so a component copied by the shadcn CLI works
 * with only the --ze-* variables. The bare ze-* class names stay as hooks for theme overrides.
 */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ze-focus)]";
export const INPUT_FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ze-focus)]";
export const ROOT = "ze-root text-[var(--ze-fg)] [font-family:var(--ze-font)]";
export const HEADING =
  "ze-heading [font-family:var(--ze-font-display)] [font-weight:var(--ze-heading-weight)] [text-transform:var(--ze-heading-transform)] [letter-spacing:var(--ze-heading-tracking)] text-[length:var(--ze-heading-size)] leading-[1.2]";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        ROOT,
        "rounded-[var(--ze-radius)] border border-[var(--ze-border)] bg-[var(--ze-bg)] shadow-[var(--ze-shadow)]",
        className,
      )}
      {...p}
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...p }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        FOCUS,
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--ze-radius-sm)] font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "md" ? "h-9 px-3.5 text-sm" : "h-7 px-2.5 text-xs",
        variant === "primary" && "bg-[var(--ze-primary)] text-[var(--ze-primary-fg)] hover:opacity-90",
        variant === "outline" && "border border-[var(--ze-border-strong)] bg-[var(--ze-bg)] hover:bg-[var(--ze-fill)]",
        variant === "ghost" && "text-[var(--ze-fg)] hover:bg-[var(--ze-fill)]",
        className,
      )}
      {...p}
    />
  );
}

export const platformName = (platform: string) => SPECS[platform as PlatformId]?.name ?? platform;

/** Neutral text badge per platform. Deliberately no brand logos or brand colors. */
export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[calc(var(--ze-radius-sm)-2px)] border border-[var(--ze-border)] bg-[var(--ze-surface)] px-1.5 text-[11px] leading-none font-semibold whitespace-nowrap text-[var(--ze-fg)]",
        className,
      )}
    >
      {platformName(platform)}
    </span>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--ze-border)] px-5 py-3">
        <div className="min-w-0">
          <h2 className={HEADING}>{title}</h2>
          {description && <p className="mt-0.5 text-xs text-[var(--ze-muted)]">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("ze-skeleton animate-pulse rounded-[var(--ze-radius-sm)] bg-[var(--ze-fill)] motion-reduce:animate-none", className)} />;
}

/** A calm, centred message for empty and error states. */
export function Notice({
  title,
  children,
  action,
  tone = "neutral",
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-[var(--ze-radius-sm)] border border-dashed px-6 py-10 text-center",
        tone === "danger" ? "border-[var(--ze-danger)]" : "border-[var(--ze-border-strong)]",
        className,
      )}
    >
      <p className={cn("text-sm font-semibold", tone === "danger" && "text-[var(--ze-danger)]")}>{title}</p>
      {children && <div className="max-w-sm text-xs leading-relaxed text-[var(--ze-muted)]">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ZernioError) {
    const b = error.body as { error?: unknown; message?: unknown } | null;
    const detail = typeof b?.error === "string" ? b.error : typeof b?.message === "string" ? b.message : "";
    if (error.status === 401) return "You are signed out. Sign in again to continue.";
    if (error.status === 402) return detail || "This needs a paid Zernio plan or add-on.";
    if (error.status === 403) return detail || "This account isn't allowed to do that.";
    if (error.status === 429) return "Too many requests. Try again in a minute.";
    return detail || `Zernio returned ${error.status}.`;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function ErrorNotice({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <Notice
      tone="danger"
      title={title}
      action={
        onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Notice>
  );
}

export function Avatar({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return src && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--ze-fill)] font-semibold text-[var(--ze-muted)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials || "?"}
    </span>
  );
}

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
  if (abs < 60) return "now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86_400 * 7) return rtf.format(Math.round(diff / 86_400), "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
