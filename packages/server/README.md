# @zernio-elements/server

`createZernioHandler(options)` returns `GET/POST/PUT/PATCH/DELETE` route handlers that proxy the browser to the Zernio
API with the key kept server-side. `resolveTenant(req)` scopes every call to one profile; `DEFAULT_RULES` (`allowlist.ts`)
lists which Zernio paths and methods may pass; without an API key the handler serves `mockResponse` fixtures, so the
components run with no Zernio account. Mount it at `app/api/zernio/[...path]/route.ts`.

Test with `pnpm --filter @zernio-elements/server test` (`handler.test.ts`).
