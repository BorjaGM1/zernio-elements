"use client";

import { useEffect, useRef, useState } from "react";
import { useInbox, useMessages } from "../hooks";
import { Avatar, Button, ErrorNotice, INPUT_FOCUS, Notice, Section, Skeleton, cn, errorMessage, platformName, relativeTime } from "./ui";

/** DMs from every connected account in one list. Reply goes out from the account that received it. */
export function Inbox() {
  const inbox = useInbox();
  const [active, setActive] = useState<string | null>(null);
  const current = inbox.data?.find((c) => c.id === active) ?? inbox.data?.[0] ?? null;
  const thread = useMessages(current);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  // Braces matter: scrollIntoView returns a Promise in current Chrome, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [thread.data?.length]);

  const unread = (inbox.data ?? []).reduce((n, c) => n + (c.unreadCount ?? 0), 0);

  return (
    <Section title="Inbox" description={inbox.data ? (unread ? `${unread} unread` : "All caught up") : undefined} bodyClassName="p-0">
      {inbox.isError ? (
        <div className="p-5">
          <ErrorNotice error={inbox.error} onRetry={() => inbox.refetch()} title="Couldn't load conversations" />
        </div>
      ) : inbox.data && inbox.data.length === 0 ? (
        <div className="p-5">
          <Notice title="No conversations yet">Direct messages from your connected accounts will land here.</Notice>
        </div>
      ) : (
        <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul className="divide-y divide-[var(--ze-border)] border-b border-[var(--ze-border)] md:border-r md:border-b-0" aria-label="Conversations">
            {inbox.isPending &&
              [0, 1, 2].map((i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </li>
              ))}
            {inbox.data?.map((c) => {
              const on = c.id === current?.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={on}
                    onClick={() => setActive(c.id)}
                    className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors", on ? "bg-[var(--ze-fill)]" : "hover:bg-[var(--ze-surface)]")}
                  >
                    <Avatar name={c.participantName ?? "?"} src={c.participantPicture} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", c.unreadCount ? "font-semibold" : "font-medium")}>{c.participantName}</span>
                        <span className="shrink-0 text-[11px] text-[var(--ze-muted)] tabular-nums">{relativeTime(c.updatedTime)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="shrink-0 text-[11px] font-medium text-[var(--ze-muted)]">{platformName(c.platform)}</span>
                        <span className={cn("truncate text-xs", c.unreadCount ? "text-[var(--ze-fg)]" : "text-[var(--ze-muted)]")}>{c.lastMessage}</span>
                        {c.unreadCount ? <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[var(--ze-primary)]" aria-label="Unread" /> : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex min-h-[420px] flex-col">
            {current && (
              <div className="flex items-center gap-2 border-b border-[var(--ze-border)] px-4 py-3">
                <span className="text-sm font-semibold">{current.participantName}</span>
                <span className="text-xs text-[var(--ze-muted)]">
                  {platformName(current.platform)}
                  {current.accountUsername ? ` · to @${current.accountUsername}` : ""}
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {thread.isPending && current && (
                <>
                  <Skeleton className="h-9 w-2/3" />
                  <Skeleton className="ml-auto h-9 w-1/2" />
                </>
              )}
              {thread.isError && <ErrorNotice error={thread.error} onRetry={() => thread.refetch()} title="Couldn't load messages" />}
              {thread.data?.map((m) => (
                <div key={m.id} className={cn("flex max-w-[80%] flex-col gap-0.5", m.direction === "outgoing" ? "ml-auto items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-[var(--ze-radius)] px-3 py-2 text-sm leading-snug",
                      m.direction === "outgoing" ? "bg-[var(--ze-primary)] text-[var(--ze-primary-fg)]" : "bg-[var(--ze-fill)]",
                    )}
                  >
                    {m.text}
                  </div>
                  <span className="px-1 text-[10px] text-[var(--ze-muted)] tabular-nums">{relativeTime(m.createdAt)}</span>
                </div>
              ))}
              <div ref={end} />
            </div>
            <form
              className="flex gap-2 border-t border-[var(--ze-border)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!text || !current) return;
                thread.send.mutate(text, { onSuccess: () => setDraft("") });
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!current}
                placeholder={current ? `Reply to ${current.participantName}` : "Pick a conversation"}
                aria-label="Reply"
                className={cn(INPUT_FOCUS, "h-9 min-w-0 flex-1 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-transparent px-3 text-sm focus:border-[var(--ze-fg)]")}
              />
              <Button type="submit" disabled={!draft.trim() || thread.send.isPending || !current}>
                {thread.send.isPending ? "Sending…" : "Send"}
              </Button>
            </form>
            {thread.send.error && <p className="px-3 pb-3 text-xs text-[var(--ze-danger)]">{errorMessage(thread.send.error)}</p>}
          </div>
        </div>
      )}
    </Section>
  );
}
