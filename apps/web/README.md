# apps/web

The embeddable-components demo, deployed at https://zernio-elements.vercel.app. Routes: `/` (three fictional brands,
Hostly, Ferment and Liftly, same components, three themes), `/six-lines` (the whole frontend, one component file and one
API route, shown beside the running page) and `/compose` (generative UI: a model composes a view from the catalog; without
`ANTHROPIC_API_KEY` or AI Gateway credits it shows labelled example specs). `/api/zernio/[...path]` is the server handler;
`/api/demo/*` toggles live mode for the owner. Public visitors always get fixtures.

Run with `pnpm --filter web dev`. Live mode needs `ZERNIO_API_KEY`, `ZERNIO_DEMO_PROFILE_ID` and
`ZERNIO_DEMO_SECRET` in `.env.local`. Test with `pnpm --filter web test`.
