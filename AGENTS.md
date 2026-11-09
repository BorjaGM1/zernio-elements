# Working in this repo

Zernio Elements is one kit for the [Zernio API](https://docs.zernio.com) with three surfaces on the same
logic: a per-platform rules engine, a server handler that keeps the Zernio key server-side, and React
components. It ships as embeddable components, as an MCP App (preview and approval widgets inside the chat)
and as a json-render catalog (generative UI built only from tested components). This file is for anyone,
human or agent, changing the code. `README.md` has the overview and links.

## Layout

```
packages/rules    @zernio-elements/rules    zero-dep TS: specs, validate, adapt, splitThread, applyFix,
                                            toCreatePostBody, and the MCP contract (mcp.ts: buildPreview,
                                            hashPayload, resource URIs, tool input/output types)
packages/server   @zernio-elements/server   createZernioHandler: key server-side, tenant scoping, allowlist, mock
packages/react    @zernio-elements/react    ZernioProvider, hooks, components, theme.css tokens (vars only)
packages/catalog  @zernio-elements/catalog  json-render catalog (11 components, zod props), CatalogView, catalogPrompt,
                                            validateCatalogSpec (checks prop values too); React-free ./server entry
packages/widgets  @zernio-elements/widgets  MCP App widgets (preview+approval, analytics, accounts, render-view) built
                                            from packages/react + rules, bundled to single-file HTML (vite +
                                            vite-plugin-singlefile), exported as strings for ui:// resources
apps/mcp          remote MCP server (Next.js, @modelcontextprotocol/ext-apps); Vercel root dir apps/mcp
apps/web          embeddable-components demo: Hostly/Ferment/Liftly + /six-lines + /compose
apps/docs         component catalog (ui.shadcn.com style) + shadcn registry at /r/*.json + llms.txt
docs/zernio-endpoints.txt   every endpoint path in @zernio/node 0.2.1548 (the allowlist's reference)
```

Internal packages export TS source directly (`exports: ./src/index.ts`); Next and Vite transpile them.
Each package and app has a short README with its entry points and test command.

## MCP App contract (`packages/rules/src/mcp.ts`)

- `preview_post(content, platforms, title?, media?, overrides?, scheduledFor?)` resolves the profile's
  accounts, runs rules + adapt, builds the exact `CreatePostBody` for publishable targets and its
  `payloadHash` (sha256 of canonical JSON). Nothing is published. Widget: `ui://zernio-elements/preview-post.html`.
- `publish_post(payload, payloadHash)` recomputes the hash and refuses on mismatch, runs Zernio's
  `validate/post`, POSTs **that exact payload** to `/v1/posts`, returns per-platform status and live URLs.
  It has `visibility: ["app"]`: hosts that honour it never list it to the model; only the widget's button
  calls it. In hosts that ignore visibility, keep `MCP_ALLOW_PUBLISH` off. It is marked `destructiveHint`.
  The hash is unkeyed sha256: it binds the payload to the approval, it is not an auth secret (the URL token is).
- `get_analytics(days?)` returns a daily-metrics summary. With `MCP_SAMPLE_ANALYTICS_WHEN_EMPTY=1` an empty
  period returns fixture numbers marked `sample: true` and labelled "Sample data" in widget and text.
- `check_accounts()` returns account health and connect links.
- `render_view(spec, title?)` renders a view the model composed from the catalog; every element and prop is
  validated first, invalid specs return their errors.
- Every tool declares its widget via `_meta.ui.resourceUri` and returns useful text as a fallback.
- Widgets run in the host's sandboxed iframe and never call Zernio or our API. Buttons (Publish, Edit,
  Reconnect) ask the host to call the MCP tool through the ext-apps bridge (`packages/widgets/src/bridge.tsx`).
- The server is stateless and answers `subscriptions/listen` with method-not-found (an open SSE stream would be
  cut by the platform at 60s). Logs are one `[mcp]` line per request, never arguments or the token.
- Platforms the profile has no account for render as **preview-only**: shown, never published, never blocking.
- Security: the MCP URL publishes to real accounts. Every request needs `MCP_TOKEN`, and publishing also needs
  `MCP_ALLOW_PUBLISH=1`. Never an open endpoint that publishes.

## Commands

```
pnpm install
pnpm dev           # apps/web in mock mode, no key needed
pnpm test          # all unit tests; the rules drift test runs against Zernio when ZERNIO_API_KEY is set
pnpm typecheck
pnpm build
```

Env files are gitignored: `apps/web/.env.local` (see `.env.example`) and `apps/mcp/.env.local`
(see `apps/mcp/.env.example`). Public visitors of the web demo always get fixtures; live mode is unlocked
once per browser with `/api/demo/unlock?key=<ZERNIO_DEMO_SECRET>`.

Deployment: three Vercel projects, one per app (`apps/web`, `apps/docs`, `apps/mcp` as root directories);
`apps/mcp/vercel.json` builds through turbo from the repo root. Hosts cache a chat's tool list when the chat
starts, so test MCP changes in a new chat.

## Zernio API facts (verified live or from @zernio/node 0.2.1548 types)

- Base `https://zernio.com/api`, `Authorization: Bearer <key>`. Never expose the key to the browser.
- Text counting: Zernio counts UTF-16 length on every platform (a skin-toned emoji is 4); X also counts URLs
  as 23. Our "chars" mode matches; X takes the stricter of X weighting and Zernio's count
  (`packages/rules/src/drift.test.ts`).
- `validate/post` checks each platform's full text even when `threadItems` is set, so `validationBody(payload)`
  sends the root segment as `customContent` to validate/post only; `/v1/posts` gets the approved payload
  unchanged (threadItems, no customContent). Zernio refuses DELETE on published posts.
- `POST /v1/posts` returns `{ message, post, warnings? }`; 207 means partial; `post.platforms[].accountId`
  may be a populated object. Threads: `platformSpecificData.threadItems[{content, mediaItems}]`
  (X, Threads, Bluesky).
- Inbox: `data[]` with `id/updatedTime/unreadCount`; messages need `accountId` and return `messages[].message`.
- Analytics chart: `GET /v1/analytics/daily-metrics` (`dailyData`, `totals`).
- Media: `POST /v1/media/presign` returns `{ uploadUrl, publicUrl }`; PUT the bytes without auth.
- Connect: `profileId` required; `brandName` only with `welcome=true`; X needs a payment method on the Zernio
  account (`PAYMENT_REQUIRED`). Telegram uses an access code / direct `POST {chatId}`.
- Reddit posting is blocked by Reddit; Snapchat is a closed beta. Both stay out of the demos.

## Constraints

- No platform logos or copied platform UI. Previews are faithful approximations in neutral styling.
- Fictional brands only (Hostly, Ferment, Liftly, Bodega Norte). No real company names in demos or fixtures.
- UI: no gradients, no emojis, no glassmorphism. Real type scale and spacing, token radii, empty/loading/error
  states, keyboard focus. Widgets inside a chat host must look native and calm. Screenshot every state
  (`pnpm --filter @zernio-elements/widgets screenshots`).
- Component styles live in Tailwind classes; `theme.css` holds only `--ze-*` variables (tested), because the
  shadcn registry ships variables only.
- A change is done when `pnpm test`, `pnpm typecheck` and `pnpm build` are green and the affected app has been
  smoke-tested where it runs (the web demo, the docs site, or the MCP server inside a chat host).
