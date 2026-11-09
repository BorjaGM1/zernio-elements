import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Which model /compose may use, from server env only. Null means no model: the page offers the
 * pre-built example specs instead and says so. A model response is never faked.
 *
 * ANTHROPIC_API_KEY  → Anthropic directly (claude-sonnet-5-5)
 * AI_GATEWAY_API_KEY → Vercel AI Gateway (anthropic/claude-sonnet-5.5); VERCEL_OIDC_TOKEN also works
 * COMPOSE_USE_GATEWAY=1 on Vercel → AI Gateway through the deployment's OIDC identity (no key)
 */
export function composeModel(): { model: LanguageModel; label: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })("claude-sonnet-5-5"), label: "claude-sonnet-5-5 (Anthropic API)" };
  }
  // On Vercel the gateway authenticates with the project's OIDC identity (request header), not an env var.
  const vercelOidc = process.env.VERCEL === "1" && process.env.COMPOSE_USE_GATEWAY === "1";
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || vercelOidc) {
    // A plain "provider/model" string goes through the AI Gateway, which reads the key or OIDC token itself.
    const id = process.env.COMPOSE_MODEL || "anthropic/claude-sonnet-5.5";
    return { model: id, label: `${id} (AI Gateway)` };
  }
  return null;
}
