import { useEffect, useId, useRef, useState } from "react";
import { Button, FOCUS, INPUT_FOCUS, PostPreview, cn } from "@zernio-elements/react";
import { SPECS, countText, isPlatformId, type PlatformId } from "@zernio-elements/rules";
import type { HostActions } from "../bridge";
import type { PreviewResult, PublishResult } from "../types";
import { Bone, Dot, Header, Message, Shell, Spinner, TONE_TEXT, Tag, listJoin } from "../shared";
import {
  authorFor,
  defaultTarget,
  editableText,
  orderTargets,
  outcomeOf,
  prettyCanonical,
  publishArgs,
  publishLabel,
  runEdit,
  runPublish,
  shortHash,
  stateDetail,
  stateOf,
  summary,
  type Outcome,
} from "./logic";

type Target = PreviewResult["targets"][number];

type PublishState =
  | { status: "idle" }
  | { status: "publishing" }
  | { status: "done"; result: PublishResult }
  | { status: "error"; message: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function PreviewPost({
  result: initial,
  actions,
  mock,
  initialPublish,
}: {
  result: PreviewResult;
  actions: HostActions;
  mock?: boolean;
  /** When the host opened this widget for publish_post directly. */
  initialPublish?: PublishResult;
}) {
  const [result, setResult] = useState(initial);
  const [selected, setSelected] = useState<PlatformId | undefined>(defaultTarget(initial.targets));
  const [editing, setEditing] = useState<{ platform: PlatformId; draft: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [publish, setPublish] = useState<PublishState>(initialPublish ? { status: "done", result: initialPublish } : { status: "idle" });

  // A fresh tool result (the model called preview_post again) replaces local state.
  useEffect(() => {
    setResult(initial);
    setSelected((s) => (initial.targets.some((t) => t.platform === s) ? s : defaultTarget(initial.targets)));
    setEditing(null);
    setPublish({ status: "idle" });
  }, [initial]);

  const targets = orderTargets(result.targets);
  const target = targets.find((t) => t.platform === selected) ?? targets[0];
  const published = publish.status === "done" ? publish.result : undefined;
  const locked = publish.status === "publishing" || publish.status === "done";

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      const next = await runEdit(actions, result, editing.platform, editing.draft);
      setResult(next);
      setEditing(null);
      actions.tellModel(`The user edited the ${SPECS[editing.platform].name} text in the preview widget. New payload hash: ${next.payloadHash ?? "none"}.`);
    } catch (e) {
      setEditError(errText(e));
    } finally {
      setSaving(false);
    }
  }

  async function doPublish() {
    if (!publishArgs(result)) return;
    setPublish({ status: "publishing" });
    try {
      const out = await runPublish(actions, result);
      setPublish({ status: "done", result: out });
      const links = out.platforms.map((p) => `${p.platform}: ${p.url ?? p.error ?? p.status}`).join("; ");
      actions.tellModel(`The user approved and published post ${out.postId} (status ${out.status}). ${links}`);
    } catch (e) {
      setPublish({ status: "error", message: errText(e) });
    }
  }

  return (
    <Shell>
      <Header title={publish.status === "done" ? publishedTitle(publish.result, mock) : "Review before publishing"} meta={mock ? <Tag tone="warning">Mock data</Tag> : undefined}>
        {publish.status === "done" ? publishedSummary(publish.result, result.payloadHash, mock) : summary(result)}
      </Header>

      <div className="flex flex-col border-t border-[var(--ze-border)] sm:flex-row">
        <PlatformTabs targets={targets} published={published} selected={target?.platform} onSelect={(p) => setSelected(p)} />
        {target && (
          <div
            role="tabpanel"
            id={`panel-${target.platform}`}
            aria-labelledby={`tab-${target.platform}`}
            className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:border-l sm:border-[var(--ze-border)]"
          >
            <TargetBar
              target={target}
              outcome={outcomeOf(published, target.platform)}
              canEdit={!locked && !editing}
              onEdit={() => {
                setEditError(null);
                setEditing({ platform: target.platform, draft: editableText(target) });
              }}
            />
            {editing?.platform === target.platform ? (
              <EditBox
                platform={target.platform}
                limit={target.preview.limit}
                value={editing.draft}
                saving={saving}
                error={editError}
                onChange={(draft) => setEditing({ ...editing, draft })}
                onCancel={() => setEditing(null)}
                onSave={saveEdit}
              />
            ) : (
              <Clamp key={target.platform} className={cn("transition-opacity", saving && "opacity-50")}>
                <div className={cn(MEDIA_FIRST.has(target.platform) && "mx-auto w-full max-w-[240px]", "ze-vertical-cap")}>
                  <PostPreview post={result.post} platform={target.platform} author={authorFor(result, target)} />
                </div>
              </Clamp>
            )}
          </div>
        )}
      </div>

      <Footer result={result} publish={publish} editing={!!editing} onPublish={doPublish} onOpen={actions.openLink} />
    </Shell>
  );
}

/** Feeds where the crop leads: render them narrow so a 4:5 or 9:16 frame doesn't make the card tall. */
const MEDIA_FIRST = new Set<PlatformId>(["instagram", "tiktok", "pinterest", "snapchat", "threads"]);

const CLAMP_PX = 420;

/**
 * Keeps the widget compact inside a chat (hosts size the iframe to the full content height): long
 * previews are cut at CLAMP_PX with a "Show full preview" control instead of growing the card.
 */
function Clamp({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > CLAMP_PX + 24);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el.firstElementChild ?? el);
    return () => ro.disconnect();
  }, []);
  const clamped = overflows && !open;
  return (
    <div className={className}>
      <div ref={ref} className="relative overflow-hidden" style={clamped ? { maxHeight: CLAMP_PX } : undefined}>
        {children}
        {clamped && <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[var(--ze-border)]" />}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(FOCUS, "mt-2 rounded-[4px] text-[12px] font-medium text-[var(--ze-muted)] hover:text-[var(--ze-fg)]")}
        >
          {open ? "Show less" : "Show full preview"}
        </button>
      )}
    </div>
  );
}

/** On fixtures (`mock`) nothing reaches a network, so the result never claims a post is live. */
export function publishedTitle(r: PublishResult, mock = false): string {
  const ok = r.platforms.filter((p) => !p.error && !/fail|error/i.test(p.status));
  if (!ok.length) return "Publishing failed";
  if (mock) return "Demo: nothing was posted";
  if (/schedul/i.test(r.status)) return "Scheduled";
  return ok.length === r.platforms.length ? "Published" : "Partly published";
}

export function publishedSummary(r: PublishResult, approvedHash: string | null, mock = false): string {
  const nameOf = (p: string) => (isPlatformId(p) ? SPECS[p].name : p);
  const failed = r.platforms.filter((p) => p.error || /fail|error/i.test(p.status)).map((p) => nameOf(p.platform));
  const ok = r.platforms.filter((p) => !failed.includes(nameOf(p.platform))).map((p) => nameOf(p.platform));
  const parts: string[] = [];
  if (ok.length) parts.push(`${mock ? "Would go to" : /schedul/i.test(r.status) ? "Scheduled on" : "Live on"} ${listJoin(ok)}`);
  if (failed.length) parts.push(`${listJoin(failed)} failed`);
  if (approvedHash && r.payloadHash === approvedHash) parts.push(`sha256 ${shortHash(r.payloadHash)} matches what you approved`);
  return parts.join(" · ");
}

function PlatformTabs({
  targets,
  published,
  selected,
  onSelect,
}: {
  targets: Target[];
  published?: PublishResult;
  selected?: PlatformId;
  onSelect: (p: PlatformId) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: React.KeyboardEvent, i: number) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = targets[(i + delta + targets.length) % targets.length]!;
    onSelect(next.platform);
    refs.current[next.platform]?.focus();
  }
  return (
    <div
      role="tablist"
      aria-label="Platforms"
      aria-orientation="horizontal"
      className="flex shrink-0 flex-wrap gap-0.5 px-2.5 pt-2 sm:w-44 sm:flex-col sm:flex-nowrap sm:p-2"
    >
      {targets.map((t, i) => {
        const s = stateOf(t, outcomeOf(published, t.platform));
        const active = t.platform === selected;
        return (
          <button
            key={t.platform}
            ref={(el) => {
              refs.current[t.platform] = el;
            }}
            id={`tab-${t.platform}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`panel-${t.platform}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.platform)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              FOCUS,
              "flex shrink-0 items-center gap-1.5 rounded-[var(--ze-radius-sm)] px-2 py-1.5 text-left transition-colors sm:gap-2 sm:px-2.5 sm:py-2",
              active ? "bg-[var(--ze-fill)]" : "hover:bg-[color-mix(in_srgb,var(--ze-fill)_60%,transparent)]",
            )}
          >
            <Dot tone={s.tone} />
            <span className="flex min-w-0 flex-col">
              <span className={cn("text-[13px] leading-[18px] whitespace-nowrap", active ? "font-semibold" : "font-medium")}>{t.name}</span>
              <span className={cn("hidden text-[11px] leading-4 sm:block", TONE_TEXT[s.tone])}>{s.label}</span>
            </span>
            <span className="sr-only">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function TargetBar({ target, outcome, canEdit, onEdit }: { target: Target; outcome?: Outcome; canEdit: boolean; onEdit: () => void }) {
  const s = stateOf(target, outcome);
  const danger = outcome ? outcome === "failed" : target.state === "blocked";
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <p className="min-w-0 text-[12px] leading-[18px]">
        {!outcome && (
          <>
            <span className={cn("font-medium sm:hidden", TONE_TEXT[s.tone])}>{s.label}</span>
            <span className="text-[var(--ze-muted)] sm:hidden"> · </span>
          </>
        )}
        <span className={cn(danger ? "text-[var(--ze-danger)]" : outcome ? TONE_TEXT.success : "text-[var(--ze-muted)]")}>{stateDetail(target, outcome)}</span>
      </p>
      {canEdit && (
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Edit ${target.name} text`}>
          Edit
        </Button>
      )}
    </div>
  );
}

function EditBox({
  platform,
  limit,
  value,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  platform: PlatformId;
  /** The effective limit from the preview (e.g. Telegram's 1024-char caption when media is attached). */
  limit: number;
  value: string;
  saving: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const spec = SPECS[platform];
  const count = countText(value, spec.text.countMode);
  const over = count > limit;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {spec.name} text
      </label>
      <textarea
        id={id}
        ref={ref}
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
          if (e.key === "Escape") onCancel();
        }}
        rows={Math.min(12, Math.max(5, Math.ceil(value.length / 52) + value.split("\n").length))}
        className={cn(
          INPUT_FOCUS,
          "w-full resize-y rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-[var(--ze-bg)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--ze-fg)] disabled:opacity-60",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-[11px] tabular-nums", over && !spec.text.supportsThreads ? "font-semibold text-[var(--ze-danger)]" : "text-[var(--ze-muted)]")}>
          {count.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
          {over && spec.text.supportsThreads ? " · will be split into a thread" : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || !value.trim()}>
            {saving ? (
              <>
                <Spinner className="size-3" /> Updating preview
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-[12px] text-[var(--ze-danger)]">
          Couldn't update the preview. {error}
        </p>
      )}
    </div>
  );
}

function Footer({
  result,
  publish,
  editing,
  onPublish,
  onOpen,
}: {
  result: PreviewResult;
  publish: PublishState;
  editing: boolean;
  onPublish: () => void;
  onOpen: (url: string) => Promise<void>;
}) {
  const [showPayload, setShowPayload] = useState(false);
  const payloadId = useId();
  const n = result.publishable.length;
  const blockedOrMissing = result.targets.filter((t) => t.state !== "ready");

  return (
    <div className="border-t border-[var(--ze-border)]">
      {publish.status === "done" ? (
        <PublishedList result={publish.result} onOpen={onOpen} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <p className="min-w-0 flex-1 basis-48 text-[12px] leading-[18px] text-[var(--ze-muted)]">
            {publish.status === "error" ? (
              <span role="alert" className="text-[var(--ze-danger)]">
                Publishing failed. {publish.message}
              </span>
            ) : n === 0 ? (
              blockedOrMissing.some((t) => t.state === "blocked")
                ? "Nothing can be published yet. Fix the issues above or connect an account."
                : "Nothing can be published yet. Connect an account to publish."
            ) : (
              <>
                {result.payload?.scheduledFor ? `Schedules for ${formatDate(result.payload.scheduledFor)} on ` : "Posts now to "}
                {listJoin(result.publishable.map((p) => (isPlatformId(p) ? SPECS[p].name : p)))}.
              </>
            )}
          </p>
          <Button onClick={onPublish} disabled={n === 0 || editing || publish.status === "publishing"} aria-describedby={payloadId}>
            {publish.status === "publishing" ? (
              <>
                <Spinner /> Publishing
              </>
            ) : publish.status === "error" ? (
              "Try again"
            ) : (
              publishLabel(result)
            )}
          </Button>
        </div>
      )}

      {result.payload && (
        <div className="border-t border-[var(--ze-border)]">
          <button
            type="button"
            aria-expanded={showPayload}
            aria-controls={payloadId}
            onClick={() => setShowPayload((v) => !v)}
            className={cn(FOCUS, "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[12px] text-[var(--ze-muted)] hover:text-[var(--ze-fg)]")}
          >
            <span className="flex items-center gap-1.5">
              <Chevron open={showPayload} />
              What will be sent
            </span>
            <span className="font-[family-name:var(--ze-font-mono)] text-[11px] tabular-nums">sha256 {shortHash(result.payloadHash)}</span>
          </button>
          <div id={payloadId} hidden={!showPayload} className="px-4 pb-4">
            <p className="mb-2 text-[12px] leading-[18px] text-[var(--ze-muted)]">
              The exact request body for <code className="font-[family-name:var(--ze-font-mono)] text-[11px]">POST /v1/posts</code>. Publishing sends these bytes unchanged; the
              server rejects anything whose hash doesn't match.
            </p>
            <pre
              tabIndex={0}
              aria-label="Payload JSON"
              className={cn(
                FOCUS,
                "max-h-52 overflow-auto rounded-[var(--ze-radius-sm)] border border-[var(--ze-border)] bg-[var(--ze-surface)] p-3 font-[family-name:var(--ze-font-mono)] text-[11px] leading-[1.55] whitespace-pre text-[var(--ze-fg)]",
              )}
            >
              {prettyCanonical(result.payload)}
            </pre>
            <p className="mt-2 font-[family-name:var(--ze-font-mono)] text-[11px] break-all text-[var(--ze-muted)]">sha256 {result.payloadHash}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PublishedList({ result, onOpen }: { result: PublishResult; onOpen: (url: string) => Promise<void> }) {
  const [linkError, setLinkError] = useState<string | null>(null);
  return (
    <div className="flex flex-col">
      <ul className="flex flex-col">
        {result.platforms.map((p) => {
          const failed = !!p.error || /fail|error/i.test(p.status);
          const name = isPlatformId(p.platform) ? SPECS[p.platform].name : p.platform;
          return (
            <li key={`${p.platform}-${p.accountId}`} className="flex items-center justify-between gap-3 border-b border-[var(--ze-border)] px-4 py-2.5 last:border-b-0">
              <div className="flex min-w-0 items-start gap-2.5">
                <Dot tone={failed ? "danger" : "success"} className="mt-[6px]" />
                <div className="min-w-0">
                  <p className="text-[13px] leading-[18px] font-medium">{name}</p>
                  <p className={cn("text-[12px] leading-[18px]", failed ? "text-[var(--ze-danger)]" : "text-[var(--ze-muted)]")}>
                    {failed ? (p.error ?? `Status: ${p.status}`) : statusText(p.status)}
                  </p>
                </div>
              </div>
              {p.url && !failed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpen(p.url!).catch((e) => setLinkError(errText(e)))}
                  aria-label={`Open the ${name} post`}
                >
                  Open post
                  <ArrowOut />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {(result.warnings.length > 0 || linkError || result.platforms.some((p) => p.error)) && (
        <div className="flex flex-col gap-1 border-t border-[var(--ze-border)] px-4 py-2.5 text-[12px] leading-[18px] text-[var(--ze-muted)]">
          {result.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {result.platforms.some((p) => p.error) && <p>Retrying would post again to the platforms that worked. Ask for a new preview for the failed ones instead.</p>}
          {linkError && <p className="text-[var(--ze-danger)]">{linkError}</p>}
        </div>
      )}
    </div>
  );
}

const statusText = (s: string) => (/publish/i.test(s) ? "Published" : /schedul/i.test(s) ? "Scheduled" : /pend|process|queue/i.test(s) ? "Publishing, link soon" : s.charAt(0).toUpperCase() + s.slice(1));

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className={cn("transition-transform", open && "rotate-90")}>
      <path d="M3.5 2 6.5 5l-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowOut() {
  return (
    <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
      <path d="M3.5 2.5h4v4M7.5 2.5 2.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Skeleton while the tool runs. Uses the streamed arguments, when there are any, to name the tabs. */
export function PreviewSkeleton({ platforms }: { platforms: string[] }) {
  const names = platforms.filter(isPlatformId).map((p) => SPECS[p].name);
  return (
    <Shell>
      <div aria-busy="true" aria-label="Preparing previews">
        <Header title="Preparing previews">{names.length ? `Checking ${listJoin(names)}` : <Bone className="mt-1 h-3 w-56" />}</Header>
        <div className="flex flex-col border-t border-[var(--ze-border)] sm:flex-row">
          <div className="flex gap-1 px-3 py-2 sm:w-44 sm:flex-col sm:gap-0.5 sm:p-2">
            {(names.length ? names : ["", "", ""]).map((n, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 sm:py-2">
                <span className="size-[7px] rounded-full bg-[var(--ze-fill)]" />
                {n ? <span className="text-[13px] font-medium text-[var(--ze-muted)]">{n}</span> : <Bone className="h-3 w-14" />}
              </div>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4 sm:border-l sm:border-[var(--ze-border)]">
            <Bone className="h-3 w-40" />
            <div className="flex flex-col gap-3 rounded-[var(--ze-radius)] border border-[var(--ze-border)] p-3.5">
              <div className="flex items-center gap-2.5">
                <Bone className="size-8 rounded-full" />
                <Bone className="h-3 w-28" />
              </div>
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-11/12" />
              <Bone className="h-3 w-3/5" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end border-t border-[var(--ze-border)] px-4 py-3">
          <Bone className="h-9 w-24 rounded-[var(--ze-radius-sm)]" />
        </div>
      </div>
    </Shell>
  );
}

export function PreviewError({ message }: { message: string }) {
  return (
    <Shell>
      <Message tone="danger" title="Couldn't build the preview">
        {message}
      </Message>
    </Shell>
  );
}
