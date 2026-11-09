import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwner, OWNER_COOKIE, ownerToken } from "../lib/owner";

const req = (cookie?: string) => new Request("https://demo.test/api/zernio/v1/accounts", { headers: cookie ? { cookie } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("isOwner (public visitors never reach the live handler)", () => {
  it("needs a key, a secret and the hashed cookie", () => {
    vi.stubEnv("ZERNIO_API_KEY", "sk");
    vi.stubEnv("ZERNIO_DEMO_SECRET", "s3cret");
    vi.stubEnv("NODE_ENV", "production");
    expect(isOwner(req())).toBe(false);
    expect(isOwner(req(`${OWNER_COOKIE}=s3cret`))).toBe(false); // the raw secret is not the cookie
    expect(isOwner(req(`${OWNER_COOKIE}=${ownerToken("wrong")}`))).toBe(false);
    expect(isOwner(req(`other=1; ${OWNER_COOKIE}=${ownerToken("s3cret")}`))).toBe(true);
  });

  it("is never owner without an API key or in mock mode", () => {
    vi.stubEnv("ZERNIO_DEMO_SECRET", "s3cret");
    vi.stubEnv("ZERNIO_API_KEY", "");
    expect(isOwner(req(`${OWNER_COOKIE}=${ownerToken("s3cret")}`))).toBe(false);
    vi.stubEnv("ZERNIO_API_KEY", "sk");
    vi.stubEnv("ZERNIO_MOCK", "1");
    expect(isOwner(req(`${OWNER_COOKIE}=${ownerToken("s3cret")}`))).toBe(false);
  });

  it("refuses everyone in production when no secret is configured", () => {
    vi.stubEnv("ZERNIO_API_KEY", "sk");
    vi.stubEnv("ZERNIO_DEMO_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isOwner(req())).toBe(false);
  });
});
