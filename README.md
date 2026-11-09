# Zernio Elements

## Links

| What | URL | What to look at |
| --- | --- | --- |
| Demo video (2:45) | https://zernio-elements.vercel.app/zernio-elements-demo.mp4 | The three blocks, then the same blocks in a product, in Claude and in generated views. |
| MCP App docs and how to add the connector | https://zernio-elements-docs.vercel.app/agents/mcp-app | How the hash binds approval to the payload; env vars; "Try the demo" and "Run your own". |
| Try the MCP App in Claude | https://zernio-elements-mcp.vercel.app/mcp | Add it as a custom connector (Settings → Connectors). Sample accounts and data; Publish is simulated, nothing is posted. Real accounts use a private `/mcp/<token>` URL. |
| Embeddable demo, 3 brands | https://zernio-elements.vercel.app | Hostly, Ferment, Liftly: same components, three themes. Public visitors see demo data. |
| The whole frontend in one file | https://zernio-elements.vercel.app/six-lines | One component file and one API route, shown beside the running page. |
| Generative UI (json-render) | https://zernio-elements.vercel.app/compose · https://zernio-elements-docs.vercel.app/agents/generative-ui | A model composes views only from the 11-component catalog; invalid specs are rejected. |
| Docs and component catalog | https://zernio-elements-docs.vercel.app | Every component with props, install command and live preview. |
| shadcn registry | https://zernio-elements-docs.vercel.app/r/registry.json | `npx shadcn@latest add https://zernio-elements-docs.vercel.app/r/composer.json` |
| llms.txt | https://zernio-elements-docs.vercel.app/llms.txt | The kit summarised for a coding agent. |

## What it is

The UI building blocks for the [Zernio API](https://docs.zernio.com). Like shadcn/ui, you install the source
into your own app and own it. Unlike it, the blocks are opinionated: they already know how every network works.
There are three: a per-platform rules engine (limits, thread splitting and media rules for 15 networks, counted
the way Zernio counts), React components and hooks, and a server handler that keeps the Zernio key server-side.

The same blocks go three places. Into an app you already have, as components you restyle with your own tokens.
Into an agent's chat, as an MCP App: instead of a line of text, the agent answers with a widget that shows the
post on every network and the actual `POST /v1/posts` body, bound by a sha256 hash, and only the person's click
publishes. And into views a model composes from a catalog of the same components, without inventing UI.

## Status and limits

- **MCP App in Claude.** Verified live in claude.ai: `preview_post` renders the widget, inline edits rebuild the
  payload on the server, and Publish from the widget published a real Bluesky post (a native thread) through
  Zernio. Built on the MCP Apps spec (`@modelcontextprotocol/ext-apps`), so other MCP Apps hosts (ChatGPT, VS Code,
  Goose) should work but were not tested.
- **Widget-only publish.** Claude doesn't give `publish_post` to the model (`visibility: ["app"]`, per the MCP Apps
  spec). The server also requires the exact previewed payload and hash, and `MCP_ALLOW_PUBLISH` is the backstop for
  hosts that ignore visibility. A test asserts the widget payload and the body sent to Zernio are identical.
- **Accounts.** The demo profile has Bluesky connected. X needs a payment method on the Zernio account, so X,
  Instagram, LinkedIn and TikTok render as preview-only: shown, never published, never blocking.
- **Analytics.** The analytics widget shows sample data, labelled "Sample data", until the profile has history.
- **Rules engine.** Text counting matches Zernio's (UTF-16, X URL weighting), checked by a drift test that runs
  against the live API when `ZERNIO_API_KEY` is set.
- **One profile per deployment.** A connect page that takes a profile-scoped, expiring key and returns a personal
  connector URL is not shipped yet.

## How it works (the MCP flow)

1. `preview_post(content, platforms, ...)` adapts the post per platform, builds the exact `CreatePostBody` for the
   publishable targets and its `payloadHash` (sha256 of canonical JSON). Nothing is published.
2. The widget renders that payload: previews, thread splits, blocking issues, and the raw body.
3. Inline edits call `preview_post` again with overrides; payload and hash are rebuilt on the server, never patched in
   the widget.
4. The Publish button calls `publish_post(payload, payloadHash)`. The server recomputes the hash, refuses a mismatch,
   runs Zernio's `validate/post`, then POSTs that exact body to `/v1/posts` and returns per-platform status and URLs.
5. Widgets run in the host's sandboxed iframe and never call Zernio; the key stays on the server behind a secret
   token in the connector URL.

## Repo layout

```
packages/rules    @zernio-elements/rules    zero-dep TS: specs, validate, adapt, splitThread, applyFix,
                                            toCreatePostBody, and the MCP contract (mcp.ts: buildPreview,
                                            hashPayload, resource URIs, tool input/output types)
packages/server   @zernio-elements/server   createZernioHandler: key server-side, tenant scoping, allowlist, mock
packages/react    @zernio-elements/react    ZernioProvider, hooks, components, theme.css tokens (vars only)
packages/catalog  @zernio-elements/catalog  json-render catalog (11 components, zod props), CatalogView, catalogPrompt,
                                            validateCatalogSpec (checks prop values too); React-free ./server entry
packages/widgets  @zernio-elements/widgets  MCP App widgets (preview+approval, analytics, accounts, render-view) built from
                                            packages/react + rules, bundled to single-file HTML
apps/mcp          remote MCP server (Vercel, root dir apps/mcp) using @modelcontextprotocol/ext-apps
apps/web          embeddable-components demo: Hostly/Ferment/Liftly + /six-lines + /compose
apps/docs         component catalog (ui.shadcn.com style) + shadcn registry at /r/*.json + llms.txt
docs/             zernio-endpoints.txt, every endpoint path in @zernio/node 0.2.1548 (the allowlist's reference)
```

Each package and app has its own short README. `AGENTS.md` holds the architecture notes, the MCP contract and the
Zernio API facts a contributor needs.

## Run locally

```
pnpm install
pnpm dev                 # the components demo in mock mode, no key needed
pnpm --filter docs dev   # the docs site
pnpm --filter mcp dev    # the MCP server
```

Live mode needs `ZERNIO_API_KEY` and `ZERNIO_DEMO_PROFILE_ID` in `apps/web/.env.local`. The MCP server's variables
(`MCP_TOKEN`, `ZERNIO_API_KEY`, `ZERNIO_PROFILE_ID`, `MCP_ALLOW_PUBLISH`) are documented on the
[MCP App page](https://zernio-elements-docs.vercel.app/agents/mcp-app).

```tsx
// app/social/page.tsx                       // app/api/zernio/[...path]/route.ts
<ZernioProvider>                              export const { GET, POST, PUT, PATCH, DELETE } = createZernioHandler({
  <ConnectAccounts />                           apiKey: process.env.ZERNIO_API_KEY,
  <Composer />                                  resolveTenant: async (req) => ({ profileId: await profileFor(req) }),
  <Calendar />                                });
</ZernioProvider>
```

## Tests

```
pnpm test        # unit tests in every package and app; the rules drift test hits Zernio when ZERNIO_API_KEY is set
pnpm typecheck
pnpm build
```

## License

MIT. See [LICENSE](LICENSE).
