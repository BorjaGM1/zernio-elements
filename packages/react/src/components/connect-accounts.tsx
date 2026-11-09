"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlatformId } from "@zernio-elements/rules";
import { useAccounts, useConnect, useConnectTelegramChannel, useTelegramConnectStatus, type Account, type ConnectOptions, type ConnectStart } from "../hooks";
import { Avatar, Button, ErrorNotice, INPUT_FOCUS, Section, Skeleton, cn, errorMessage, platformName } from "./ui";

/** Publishing platforms Zernio connects with an OAuth redirect (Telegram: an access code instead). */
const DEFAULT_PLATFORMS: PlatformId[] = ["twitter", "bluesky", "threads", "instagram", "linkedin", "facebook", "telegram", "tiktok", "youtube", "pinterest"];

/**
 * Connect / reconnect social accounts through Zernio Connect.
 * White-label: `branding` puts your name, logo and color on Zernio's welcome screen;
 * `headless` hands the raw OAuth result back to your redirectUrl; `oauthAppId` uses your own OAuth app.
 */
export function ConnectAccounts({
  platforms = DEFAULT_PLATFORMS,
  redirectUrl,
  branding,
  headless,
  oauthAppId,
  title = "Connected accounts",
}: {
  platforms?: readonly PlatformId[];
  redirectUrl?: string;
  branding?: Pick<ConnectOptions, "brandName" | "logoUrl" | "primaryColor">;
  headless?: boolean;
  oauthAppId?: string;
  title?: string;
}) {
  const accounts = useAccounts();
  const connect = useConnect();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [codeFlow, setCodeFlow] = useState<Extract<ConnectStart, { kind: "code" }> | null>(null);

  // Zernio redirects back with ?connected=<platform>&username=... (or error=...). Show it, refresh, clean the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const error = url.searchParams.get("error");
    if (!connected && !error) return;
    setNotice(
      connected
        ? { tone: "ok", text: `${platformName(connected)} connected${url.searchParams.get("username") ? ` as @${url.searchParams.get("username")}` : ""}.` }
        : { tone: "error", text: url.searchParams.get("error_message") ?? `Connection failed (${error}).` },
    );
    qc.invalidateQueries({ queryKey: ["zernio", "accounts"] });
    for (const k of ["connected", "profileId", "accountId", "username", "request_id", "stage", "error", "error_message"]) url.searchParams.delete(k);
    window.history.replaceState(null, "", url.toString());
  }, [qc]);

  async function start(platform: PlatformId, reconnect?: Account) {
    setPending(platform);
    setNotice(null);
    try {
      const r = await connect.mutateAsync({
        platform,
        redirectUrl,
        headless,
        oauthAppId,
        reconnectAccountId: reconnect?._id,
        ...branding,
      });
      if (r.kind === "code") {
        setCodeFlow(r);
      } else if (r.authUrl.startsWith("about:")) {
        setNotice({ tone: "ok", text: `Demo mode: this would open ${platformName(platform)}'s sign-in.` });
      } else {
        window.location.assign(r.authUrl);
        return;
      }
    } catch (e) {
      setNotice({ tone: "error", text: errorMessage(e) });
    }
    setPending(null);
  }

  const byPlatform = new Map<string, Account[]>();
  for (const a of accounts.data ?? []) byPlatform.set(a.platform, [...(byPlatform.get(a.platform) ?? []), a]);
  const connectedCount = platforms.filter((p) => byPlatform.has(p)).length;

  return (
    <Section
      title={title}
      description={accounts.data ? `${connectedCount} of ${platforms.length} platforms connected` : undefined}
      bodyClassName="p-0"
    >
      {notice && (
        <div
          role="status"
          className={cn(
            "border-b border-[var(--ze-border)] px-5 py-2.5 text-xs",
            notice.tone === "ok" ? "text-[var(--ze-success)]" : "text-[var(--ze-danger)]",
          )}
        >
          {notice.text}
        </div>
      )}
      {codeFlow && <TelegramCode flow={codeFlow} onClose={() => setCodeFlow(null)} />}
      {accounts.isError ? (
        <div className="p-5">
          <ErrorNotice error={accounts.error} onRetry={() => accounts.refetch()} title="Couldn't load accounts" />
        </div>
      ) : (
        <ul className="divide-y divide-[var(--ze-border)]">
          {platforms.map((p) => {
            const list = byPlatform.get(p) ?? [];
            return (
              <li key={p} className="flex min-h-16 items-center gap-4 px-5 py-3">
                <span className="w-24 shrink-0 text-sm font-semibold">{platformName(p)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {accounts.isPending ? (
                    <Skeleton className="h-4 w-32" />
                  ) : list.length === 0 ? (
                    <span className="text-sm text-[var(--ze-muted)]">Not connected</span>
                  ) : (
                    list.map((a) => (
                      <div key={a._id} className="flex min-w-0 items-center gap-2">
                        <Avatar name={a.displayName ?? a.username ?? p} src={a.profilePicture} size={24} />
                        <span className="truncate text-sm">{a.username ? `@${a.username.replace(/^@/, "")}` : a.displayName}</span>
                        {a.needsReconnection ? (
                          <button
                            type="button"
                            onClick={() => start(p, a)}
                            className="shrink-0 text-xs font-medium text-[var(--ze-warning)] underline underline-offset-2"
                          >
                            Needs reconnecting
                          </button>
                        ) : (
                          <span className="shrink-0 text-xs text-[var(--ze-success)]">Active</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <Button
                  variant={list.length ? "ghost" : "outline"}
                  size="sm"
                  disabled={pending !== null || accounts.isPending}
                  onClick={() => start(p)}
                >
                  {pending === p ? "Opening…" : list.length ? "Add another" : "Connect"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}


function TelegramCode({ flow, onClose }: { flow: Extract<ConnectStart, { kind: "code" }>; onClose: () => void }) {
  const status = useTelegramConnectStatus(flow.code);
  const direct = useConnectTelegramChannel();
  const [chat, setChat] = useState("");
  const state = direct.isSuccess ? "connected" : status.data?.status;
  return (
    <div className="border-b border-[var(--ze-border)] bg-[var(--ze-surface)] px-5 py-4" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Connect a Telegram channel</span>
          <ol className="flex flex-col gap-1 text-xs text-[var(--ze-muted)]">
            {flow.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
          <code className="w-fit rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-[var(--ze-bg)] px-2.5 py-1 font-mono text-sm tracking-wider select-all">
            {flow.code}
          </code>
          <form
            className="mt-1 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (chat.trim()) direct.mutate(chat);
            }}
          >
            <span className="text-xs text-[var(--ze-muted)]">Public channel? Once the bot is an admin, just enter it:</span>
            <input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              placeholder="@yourchannel"
              aria-label="Telegram channel username"
              className={cn(INPUT_FOCUS, "h-7 w-40 rounded-[var(--ze-radius-sm)] border border-[var(--ze-border-strong)] bg-[var(--ze-bg)] px-2 text-xs")}
            />
            <Button size="sm" variant="outline" type="submit" disabled={!chat.trim() || direct.isPending}>
              {direct.isPending ? "Connecting…" : "Connect channel"}
            </Button>
          </form>
          {direct.isError && <span className="text-xs text-[var(--ze-danger)]">{errorMessage(direct.error)}</span>}
          <span className={cn("text-xs", state === "connected" ? "text-[var(--ze-success)]" : state === "expired" ? "text-[var(--ze-danger)]" : "text-[var(--ze-muted)]")}>
            {state === "connected"
              ? `Connected${status.data?.chatTitle ? `: ${status.data.chatTitle}` : direct.data?.account?.username ? `: @${direct.data.account.username}` : ""}.`
              : state === "expired"
                ? "The code expired. Start again."
                : status.isError
                  ? errorMessage(status.error)
                  : "Waiting for the bot to see the code…"}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {state === "connected" ? "Done" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
