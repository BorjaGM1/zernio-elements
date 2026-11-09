"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adapt, SPECS, type Issue, type PlatformId } from "@zernio-elements/rules";
import { isPublishingAccount, useAccounts, useComposer, useMediaUpload, usePost, type ComposerController, type Post } from "../hooks";
import { PreviewGrid } from "./post-preview";
import { Button, Card, ErrorNotice, FOCUS, INPUT_FOCUS, PlatformBadge, ROOT, Skeleton, cn, errorMessage, platformName } from "./ui";

const SEVERITY_LABEL: Record<Issue["severity"], string> = { error: "Fix", warning: "Check", info: "Note" };
const SEVERITY_COLOR: Record<Issue["severity"], string> = {
  error: "text-[var(--ze-danger)]",
  warning: "text-[var(--ze-warning)]",
  info: "text-[var(--ze-info)]",
};
const FIX_LABEL: Partial<Record<NonNullable<Issue["fix"]>, string>> = {
  truncate: "Shorten for this platform",
  "add-title": "Use first line as title",
  "drop-hashtags": "Drop extra hashtags",
  "remove-extra-media": "Remove extra media",
};

const TITLE_PLATFORMS: PlatformId[] = ["youtube", "reddit", "pinterest"];

/**
 * One composer, every platform. Live per-platform validation, one-click fixes and previews.
 * Pass your own `controller` (from useComposer) to drive it from outside, e.g. from an AI agent.
 */
export function Composer({
  controller,
  showPreviews = true,
  author,
  onPublished,
  placeholder = "Write once. It adapts to every platform you pick.",
  previewWithoutAccount = [],
}: {
  controller?: ComposerController;
  showPreviews?: boolean;
  /** Name and handle shown in the previews. */
  author?: { name: string; handle: string; avatar?: string };
  onPublished?: (post: Post) => void;
  placeholder?: string;
  /** Platforms the user can preview even with no connected account (shown under "Preview only"). */
  previewWithoutAccount?: readonly PlatformId[];
}) {
  const internal = useComposer();
  const c = controller ?? internal;
  const ids = { text: useId(), title: useId(), when: useId() };
  const [scheduleAt, setScheduleAt] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const titleFor = c.platforms.filter((p) => TITLE_PLATFORMS.includes(p));
  const errors = c.validation.issues.filter((i) => i.severity === "error");
  const canPublish = c.targets.length > 0 && errors.length === 0 && !c.publish.isPending && (scheduleAt === null || Boolean(scheduleAt));

  async function submit() {
    const schedule = scheduleAt
      ? { scheduledFor: new Date(scheduleAt).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      : { publishNow: true };
    const r = await c.publish.mutateAsync(schedule);
    setPublishedId(r.post._id);
    onPublished?.(r.post);
  }

  return (
    <div className={cn(ROOT, "grid items-start gap-5", showPreviews && "xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]")}>
      <Card className="flex flex-col">
        {/* After publishing, the draft is locked until "New post": the result below is the next step. */}
        <div inert={Boolean(publishedId)} className={cn("transition-opacity", publishedId && "opacity-50")}>
        <AccountPicker c={c} previewWithoutAccount={previewWithoutAccount} />

        <div className="flex flex-col gap-4 px-5 py-4">
          {titleFor.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.title} className="flex items-baseline justify-between text-xs font-medium">
                Title
                <span className="font-normal text-[var(--ze-muted)]">{titleFor.map(platformName).join(", ")}</span>
              </label>
              <input
                id={ids.title}
                value={c.post.title ?? ""}
                onChange={(e) => c.setTitle(e.target.value)}
                placeholder="Give it a title"
                className={cn(INPUT_FOCUS, "h-10 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-transparent px-3 text-sm focus:border-[var(--ze-fg)]")}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.text} className="sr-only">
              Post text
            </label>
            <textarea
              id={ids.text}
              value={c.post.content}
              onChange={(e) => c.setContent(e.target.value)}
              placeholder={placeholder}
              rows={7}
              className={cn(INPUT_FOCUS, "min-h-40 resize-y rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-transparent px-3 py-2.5 text-[15px] leading-relaxed placeholder:text-[var(--ze-muted)] focus:border-[var(--ze-fg)]")}
            />
            <Counters c={c} />
          </div>

          <MediaField c={c} />

          <Checks c={c} />
        </div>
        </div>

        {publishedId ? (
          <PublishStatus
            id={publishedId}
            warnings={c.publish.data?.warnings ?? []}
            demo={Boolean(c.publish.data?.mock)}
            onDone={() => {
              setPublishedId(null);
              setScheduleAt(null);
              c.publish.reset();
              c.reset();
            }}
          />
        ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ze-border)] px-5 py-3">
            <div className="flex items-center gap-2 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={scheduleAt !== null}
                  onChange={(e) => setScheduleAt(e.target.checked ? defaultScheduleTime() : null)}
                  className="accent-[var(--ze-primary)]"
                />
                Schedule
              </label>
              {scheduleAt !== null && (
                <input
                  id={ids.when}
                  aria-label="Publish at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className={cn(INPUT_FOCUS, "h-8 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-transparent px-2 text-xs")}
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--ze-muted)] tabular-nums">
                {errors.length > 0
                  ? `${errors.length} to fix`
                  : c.targets.length
                    ? `${c.targets.length} account${c.targets.length === 1 ? "" : "s"}`
                    : "Pick an account"}
              </span>
              <Button disabled={!canPublish} onClick={() => submit().catch(() => undefined)}>
                {c.publish.isPending ? "Publishing…" : scheduleAt !== null ? "Schedule" : "Publish now"}
              </Button>
            </div>
          </div>
        )}

        {c.publish.error && (
          <div role="alert" className="border-t border-[var(--ze-border)] px-5 py-3 text-xs whitespace-pre-line text-[var(--ze-danger)]">
            {errorMessage(c.publish.error)}
          </div>
        )}
      </Card>

      {showPreviews && (
        <PreviewGrid
          post={c.post}
          platforms={c.previewPlatforms}
          previewOnly={c.previewPlatforms.filter((p) => !c.platforms.includes(p))}
          author={author}
        />
      )}
    </div>
  );
}

function defaultScheduleTime() {
  const d = new Date(Date.now() + 24 * 3_600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

function AccountPicker({ c, previewWithoutAccount }: { c: ComposerController; previewWithoutAccount: readonly PlatformId[] }) {
  const accounts = useAccounts();
  const usable = (accounts.data ?? []).filter(isPublishingAccount);
  const previewable = accounts.data ? previewWithoutAccount.filter((p) => !usable.some((a) => a.platform === p)) : [];

  return (
    <div className="border-b border-[var(--ze-border)] px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-medium">Post to</span>
        {usable.length > 1 && (
          <button
            type="button"
            className="text-xs text-[var(--ze-muted)] underline-offset-2 hover:underline"
            onClick={() =>
              c.setTargets(
                c.targets.length === usable.length ? [] : usable.map((a) => ({ platform: a.platform as PlatformId, accountId: a._id })),
              )
            }
          >
            {c.targets.length === usable.length ? "Clear" : "Select all"}
          </button>
        )}
      </div>
      {accounts.isPending ? (
        <div className="flex gap-2" aria-label="Loading accounts">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      ) : accounts.isError ? (
        <ErrorNotice error={accounts.error} onRetry={() => accounts.refetch()} title="Couldn't load accounts" />
      ) : usable.length === 0 ? (
        <p className="text-sm text-[var(--ze-muted)]">No accounts connected yet. Connect one to start publishing.</p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Accounts">
          {usable.map((acc) => {
            const on = c.targets.some((t) => t.accountId === acc._id);
            return (
              <button
                key={acc._id}
                type="button"
                aria-pressed={on}
                onClick={() => c.toggleTarget({ platform: acc.platform as PlatformId, accountId: acc._id })}
                className={cn(
                  FOCUS,
                  "inline-flex h-8 items-center gap-2 rounded-[var(--ze-radius-sm)] border pr-2.5 pl-1 text-xs transition-colors",
                  on
                    ? "border-[var(--ze-primary)] bg-[var(--ze-bg)] text-[var(--ze-fg)] shadow-[inset_0_0_0_1px_var(--ze-primary)]"
                    : "border-[var(--ze-border)] text-[var(--ze-muted)] hover:border-[var(--ze-border-strong)] hover:text-[var(--ze-fg)]",
                )}
              >
                <span
                  className={cn(
                    "rounded-[calc(var(--ze-radius-sm)-3px)] px-1.5 py-0.5 text-[11px] font-semibold",
                    on ? "bg-[var(--ze-primary)] text-[var(--ze-primary-fg)]" : "bg-[var(--ze-fill)] text-[var(--ze-fg)]",
                  )}
                >
                  {platformName(acc.platform)}
                </span>
                <span className="max-w-32 truncate">{acc.username ? `@${acc.username.replace(/^@/, "")}` : acc.displayName}</span>
              </button>
            );
          })}
        </div>
      )}
      {previewable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Preview only">
          <span className="mr-1 text-[11px] text-[var(--ze-muted)]">Preview only</span>
          {previewable.map((p) => {
            const on = c.previewOnly.includes(p);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                title={`No ${platformName(p)} account connected: previewed, not published`}
                onClick={() => c.togglePreview(p)}
                className={cn(
                  FOCUS,
                  "inline-flex h-7 items-center rounded-[var(--ze-radius-sm)] border border-dashed px-2 text-[11px] font-semibold transition-colors",
                  on ? "border-[var(--ze-fg)] text-[var(--ze-fg)]" : "border-[var(--ze-border-strong)] text-[var(--ze-muted)] hover:text-[var(--ze-fg)]",
                )}
              >
                {platformName(p)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** count/limit per selected platform; threads show how many posts the text becomes. */
function Counters({ c }: { c: ComposerController }) {
  if (!c.previewPlatforms.length) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--ze-muted)] tabular-nums" aria-label="Length per platform">
      {c.previewPlatforms.map((p) => {
        const a = adapt(c.post, p);
        const over = a.count > a.limit;
        const threaded = a.segments.length > 1;
        return (
          <li key={p} className={cn(over && !threaded && "font-semibold text-[var(--ze-danger)]")}>
            <span className="font-medium text-[var(--ze-fg)]">{SPECS[p].name}</span> {a.count}/{a.limit}
            {threaded && <span className="text-[var(--ze-info)]"> · {a.segments.length} posts</span>}
          </li>
        );
      })}
    </ul>
  );
}

function MediaField({ c }: { c: ComposerController }) {
  const upload = useMediaUpload();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [pasting, setPasting] = useState(false);

  async function onFiles(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      const m = await upload.mutateAsync(f).catch(() => null);
      if (m) c.addMedia(m);
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {c.post.media.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {c.post.media.map((m) => (
            <li key={m.url} className="group relative h-20 w-20 overflow-hidden rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-fill)]">
              {m.type === "video" ? (
                <video src={m.url} muted className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-white tabular-nums">
                {m.durationSec ? `${Math.round(m.durationSec)}s` : m.width && m.height ? `${m.width}×${m.height}` : m.type}
              </span>
              <button
                type="button"
                onClick={() => c.removeMedia(m.url)}
                aria-label="Remove media"
                className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
          {upload.isPending ? "Uploading…" : "Add image or video"}
        </Button>
        {pasting ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!url) return;
              c.addMedia({ url, type: /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? "video" : "image" });
              setUrl("");
              setPasting(false);
            }}
          >
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Media URL"
              className={cn(INPUT_FOCUS, "h-7 min-w-0 flex-1 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-transparent px-2 text-xs")}
            />
            <Button size="sm" variant="ghost" type="submit">
              Add
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setPasting(true)}>
            Paste a URL
          </Button>
        )}
      </div>
      {upload.error && <p className="text-xs text-[var(--ze-danger)]">{errorMessage(upload.error)}</p>}
    </div>
  );
}

function Checks({ c }: { c: ComposerController }) {
  if (!c.platforms.length) return null;
  const actionable = c.validation.issues.filter((i) => i.severity !== "info").sort((a, b) => rank(a.severity) - rank(b.severity));
  const notes = c.validation.issues.filter((i) => i.severity === "info");
  if (!actionable.length && !notes.length) {
    return <p className="text-xs text-[var(--ze-success)]">Ready for {c.platforms.map(platformName).join(", ")}.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {actionable.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--ze-border)] rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)]" aria-label="Checks">
          {actionable.map((i, n) => {
            const fix = i.fix && FIX_LABEL[i.fix];
            return (
              <li key={`${i.platform}-${i.code}-${n}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-xs">
                <span className={cn("w-9 shrink-0 text-[10px] font-semibold tracking-wide uppercase", SEVERITY_COLOR[i.severity])}>
                  {SEVERITY_LABEL[i.severity]}
                </span>
                <PlatformBadge platform={i.platform} />
                <span className="min-w-[12rem] flex-1 leading-snug">{i.message}</span>
                {fix && (
                  <Button size="sm" variant="outline" onClick={() => c.applyFix(i)}>
                    {fix}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 text-[11px] leading-snug text-[var(--ze-muted)]" aria-label="Notes">
          {notes.map((i, n) => (
            <li key={`${i.platform}-${i.code}-${n}`}>
              <span className="font-semibold text-[var(--ze-fg)]">{platformName(i.platform)}</span> {i.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const rank = (s: Issue["severity"]) => (s === "error" ? 0 : s === "warning" ? 1 : 2);

const STATUS_LABEL: Record<string, string> = {
  published: "Published",
  failed: "Failed",
  partial: "Partly published",
  pending: "Queued",
  scheduled: "Scheduled",
  publishing: "Publishing…",
  processing: "Processing…",
  uploading: "Uploading…",
  cancelled: "Cancelled",
};

const TERMINAL_OK = new Set(["published"]);

function PublishStatus({ id, warnings, demo, onDone }: { id: string; warnings: string[]; demo: boolean; onDone: () => void }) {
  const q = usePost(id);
  const post = q.data;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const targets = post?.platforms ?? [];
  const scheduled = post?.status === "scheduled";
  const failed = targets.filter((t) => t.status === "failed").length;
  const done = targets.length > 0 && targets.every((t) => TERMINAL_OK.has(t.status ?? "") || t.status === "failed");
  const title = !post
    ? "Publishing…"
    : scheduled
      ? "Scheduled"
      : !done
        ? "Publishing…"
        : failed === 0
          ? "Published"
          : failed === targets.length
            ? "Couldn't publish"
            : "Partly published";
  const names = targets.map((t) => platformName(t.platform)).join(", ");
  const subtitle = scheduled && post?.scheduledFor
    ? `Goes out ${new Date(post.scheduledFor).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} on ${names}.`
    : demo
      ? "Demo mode: nothing was actually posted."
      : done && failed === 0
        ? `Live on ${names}.`
        : names
          ? `Sending to ${names}.`
          : "";
  return (
    <div ref={ref} className="border-t border-[var(--ze-border)] bg-[var(--ze-surface)] px-5 py-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", title === "Couldn't publish" && "text-[var(--ze-danger)]")}>{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--ze-muted)]">{subtitle}</p>}
        </div>
        <Button onClick={onDone}>New post</Button>
      </div>
      {q.isError ? (
        <p className="mt-3 text-xs text-[var(--ze-danger)]">{errorMessage(q.error)}</p>
      ) : !post ? (
        <Skeleton className="mt-3 h-8" />
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--ze-border)] rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-bg)]">
          {targets.map((t) => (
            <li key={`${t.platform}-${t.accountId}`} className="flex items-center gap-2 px-3 py-2 text-xs">
              <PlatformBadge platform={t.platform} />
              <span
                className={cn(
                  "tabular-nums",
                  t.status === "published" && "text-[var(--ze-success)]",
                  t.status === "failed" && "text-[var(--ze-danger)]",
                )}
              >
                {scheduled ? "Scheduled" : (STATUS_LABEL[t.status ?? ""] ?? t.status ?? "Queued")}
              </span>
              {t.errorMessage && <span className="truncate text-[var(--ze-muted)]">{t.errorMessage}</span>}
              {t.platformPostUrl && (
                <a href={t.platformPostUrl} target="_blank" rel="noreferrer" className="ml-auto font-medium underline underline-offset-2">
                  View post
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-[var(--ze-muted)]">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
