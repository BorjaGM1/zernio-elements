"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

export interface ZernioContextValue {
  /** Where createZernioHandler is mounted. */
  basePath: string;
  request: <T>(method: string, path: string, body?: unknown) => Promise<T>;
}

const Ctx = createContext<ZernioContextValue | null>(null);

export class ZernioError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `Zernio ${status}`);
  }
}

/** 4xx answers won't change on retry (auth, plan, validation): fail fast. Retry 5xx and network errors once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ZernioError && error.status < 500 && error.status !== 429) return false;
  return failureCount < 1;
}

export function ZernioProvider({
  basePath = "/api/zernio",
  queryClient,
  children,
}: {
  basePath?: string;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [client] = useState(() => queryClient ?? new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: shouldRetry } } }));

  const request: ZernioContextValue["request"] = async (method, path, body) => {
    const res = await fetch(`${basePath}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ZernioError(res.status, data);
    return data;
  };

  return (
    <QueryClientProvider client={client}>
      <Ctx.Provider value={{ basePath, request }}>{children}</Ctx.Provider>
    </QueryClientProvider>
  );
}

export function useZernio(): ZernioContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("Wrap your app in <ZernioProvider>.");
  return v;
}
