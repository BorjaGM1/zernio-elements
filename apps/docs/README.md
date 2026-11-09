# apps/docs

The documentation site, deployed at https://zernio-elements-docs.vercel.app: component catalog with props, install
commands and live previews (`/components/*`, `/hooks/*`, `/rules`, `/server`, `/theming`), the agent pages
(`/agents/mcp-app`, `/agents/generative-ui`), the shadcn registry at `/r/*.json` and `/llms.txt`. `lib/catalog.ts` is
the single source for component and hook entries; `scripts/build-registry.ts` generates `public/r` and `public/llms.txt`
from the package sources before `dev` and `build`.

Run with `pnpm --filter docs dev` (port 3001). Test with `pnpm --filter docs test` (`build-registry.test.ts`).
