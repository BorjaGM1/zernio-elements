import { useState } from "react";
import { Avatar, Button, cn } from "@zernio-elements/react";
import { SPECS, isPlatformId } from "@zernio-elements/rules";
import type { HostActions } from "../bridge";
import type { AccountHealth, AccountsResult } from "../types";
import { Bone, Dot, Header, Message, Shell, TONE_TEXT, Tag, type Tone } from "../shared";

const name = (p: string) => (isPlatformId(p) ? SPECS[p].name : p.charAt(0).toUpperCase() + p.slice(1));

function health(a: AccountHealth): { label: string; tone: Tone } {
  if (a.needsReconnection) return { label: "Needs reconnecting", tone: "danger" };
  if (!a.isActive) return { label: "Paused", tone: "warning" };
  if (a.healthy === false) return { label: "Needs attention", tone: "warning" };
  return { label: "Connected", tone: "success" };
}

const isHealthy = (a: AccountHealth) => a.healthy ?? (a.isActive && !a.needsReconnection);

export function Accounts({ data, actions }: { data: AccountsResult; actions: Pick<HostActions, "openLink"> }) {
  const [error, setError] = useState<string | null>(null);
  const missing = data.missing ?? [];
  const attention = data.accounts.filter((a) => !isHealthy(a)).length;
  const open = (url: string) => {
    setError(null);
    actions.openLink(url).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const healthy = data.accounts.length - attention;
  const sub = [
    data.accounts.length ? `${healthy} of ${data.accounts.length} connected account${data.accounts.length === 1 ? "" : "s"} healthy` : "No accounts connected",
    missing.length ? `${missing.length} not connected` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Shell>
      <Header title="Accounts" meta={data.mock ? <Tag tone="warning">Mock data</Tag> : undefined}>
        {sub}
      </Header>
      {data.accounts.length > 0 && (
        <ul className="border-t border-[var(--ze-border)]">
          {data.accounts.map((a) => {
            const h = health(a);
            const fix = !isHealthy(a);
            const who = a.username ? `@${a.username.replace(/^@/, "")}` : (a.displayName ?? a.name);
            return (
              <li key={`${a.platform}-${a.accountId}`} className="flex items-center justify-between gap-3 border-b border-[var(--ze-border)] px-4 py-2.5 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={a.displayName ?? a.username ?? name(a.platform)} size={28} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] leading-[18px] font-medium">
                      {name(a.platform)}
                      {who && <span className="font-normal text-[var(--ze-muted)]"> · {who}</span>}
                    </p>
                    <p className={cn("flex items-center gap-1.5 text-[12px] leading-[18px]", TONE_TEXT[h.tone])}>
                      <Dot tone={h.tone} />
                      <span className="whitespace-nowrap">{h.label}</span>
                    </p>
                    {a.note && fix && <p className="text-[12px] leading-[18px] text-[var(--ze-muted)]">{a.note}</p>}
                  </div>
                </div>
                {fix && a.connectUrl && (
                  <Button size="sm" variant="outline" onClick={() => open(a.connectUrl!)} aria-label={`Reconnect ${name(a.platform)}`}>
                    Reconnect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="border-t border-[var(--ze-border)]">
          <h2 className="px-4 pt-3 pb-1 text-[12px] font-medium text-[var(--ze-muted)]">Not connected</h2>
          <ul>
            {missing.map((m) => (
              <li key={m.platform} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] leading-[18px] font-medium">{m.name ?? name(m.platform)}</p>
                  {m.reason && <p className="text-[12px] leading-[18px] text-[var(--ze-muted)]">{m.reason}</p>}
                </div>
                {m.connectUrl && (
                  <Button size="sm" variant="outline" onClick={() => open(m.connectUrl!)} aria-label={`Connect ${name(m.platform)}`}>
                    Connect
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="h-2" />
        </div>
      )}
      {data.accounts.length === 0 && missing.length === 0 && <Message title="No accounts yet">Connect an account to start publishing.</Message>}
      {error && (
        <p role="alert" className="border-t border-[var(--ze-border)] px-4 py-2.5 text-[12px] text-[var(--ze-danger)]">
          {error}
        </p>
      )}
    </Shell>
  );
}

export function AccountsSkeleton() {
  return (
    <Shell>
      <div aria-busy="true" aria-label="Checking accounts">
        <Header title="Accounts">
          <Bone className="mt-1 h-3 w-44" />
        </Header>
        <ul className="border-t border-[var(--ze-border)]">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 border-b border-[var(--ze-border)] px-4 py-2.5 last:border-b-0">
              <Bone className="size-7 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Bone className="h-3 w-28" />
                <Bone className="h-2.5 w-16" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

export function AccountsError({ message }: { message: string }) {
  return (
    <Shell>
      <Message tone="danger" title="Couldn't check accounts">
        {message}
      </Message>
    </Shell>
  );
}
