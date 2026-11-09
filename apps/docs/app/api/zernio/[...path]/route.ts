import { createZernioHandler } from "@zernio-elements/server";

/** Live previews on the docs run on fixtures: no API key, no network. */
export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
  mock: true,
  resolveTenant: () => ({ profileId: "docs" }),
});
