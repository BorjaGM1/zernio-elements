export interface Config {
  /** Secret that every request must carry (URL path or Bearer). No token configured = every request is refused. */
  token: string | undefined;
  apiKey: string | undefined;
  /** Zernio profile the server acts on. */
  profileId: string;
  /** Fixtures instead of Zernio. On whenever there is no API key. */
  mock: boolean;
  allowPublish: boolean;
  /** Fallback for hosts that can't call app-only tools: list publish_post to the model too. */
  publishModelVisible: boolean;
  /** When the real period has no activity, return clearly labelled sample analytics instead of an empty card. */
  sampleAnalyticsWhenEmpty: boolean;
  baseUrl: string;
  /** Polling after POST /v1/posts until every platform settles. */
  pollTimeoutMs: number;
  pollIntervalMs: number;
}

export function configFromEnv(env: Record<string, string | undefined> = process.env): Config {
  const apiKey = env.ZERNIO_API_KEY || undefined;
  return {
    token: env.MCP_TOKEN || undefined,
    apiKey,
    profileId: env.ZERNIO_PROFILE_ID || (apiKey ? "" : "mock_profile"),
    mock: !apiKey,
    allowPublish: env.MCP_ALLOW_PUBLISH === "1",
    publishModelVisible: env.MCP_PUBLISH_MODEL_VISIBLE === "1",
    sampleAnalyticsWhenEmpty: env.MCP_SAMPLE_ANALYTICS_WHEN_EMPTY === "1",
    baseUrl: (env.ZERNIO_BASE_URL || "https://zernio.com/api").replace(/\/$/, ""),
    pollTimeoutMs: 20_000,
    pollIntervalMs: 1_500,
  };
}
