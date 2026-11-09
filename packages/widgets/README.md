# @zernio-elements/widgets

The MCP App widgets: preview and approval (`preview-post`), `analytics`, `accounts` and `render-view`, built from
`packages/react` and `packages/rules` and bundled by Vite into single-file HTML. `pnpm --filter @zernio-elements/widgets
build` writes `dist/*.html` and `dist/index.js`, which exports each file as a string (`previewPostHtml`, `analyticsHtml`,
`accountsHtml`, `renderViewHtml`) for the MCP server to serve as `ui://` resources. `bridge.tsx` is the only way a widget
talks to the outside: buttons ask the host to call an MCP tool through the ext-apps bridge; widgets never call Zernio.

`pnpm --filter @zernio-elements/widgets dev` runs the harness; `screenshots` renders each widget at 720px in the dark host
theme. Test with `pnpm --filter @zernio-elements/widgets test`.
