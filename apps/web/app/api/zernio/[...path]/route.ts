import { createZernioHandler } from "@zernio-elements/server";
import { hasKey, isOwner } from "@/lib/owner";

/**
 * The only server code a SaaS needs. In a real product, resolveTenant reads your session
 * and returns the Zernio profile of the logged-in customer.
 */
const live = createZernioHandler({
  apiKey: process.env.ZERNIO_API_KEY,
  baseUrl: process.env.ZERNIO_BASE_URL || undefined,
  mock: !hasKey(),
  resolveTenant: () => (process.env.ZERNIO_DEMO_PROFILE_ID ? { profileId: process.env.ZERNIO_DEMO_PROFILE_ID } : null),
});

// Public visitors get fixtures, so nobody can publish to the demo's real accounts.
const demo = createZernioHandler({ mock: true, resolveTenant: () => ({ profileId: "demo" }) });

const route = (method: keyof typeof live) => (req: Request) => (isOwner(req) ? live : demo)[method](req);

export const GET = route("GET");
export const POST = route("POST");
export const PUT = route("PUT");
export const PATCH = route("PATCH");
export const DELETE = route("DELETE");
