# @zernio-elements/react

The React layer: `ZernioProvider` (TanStack Query client pointed at the server handler, `useZernio` for the base path and
profile), hooks (`useAccounts`, `useConnect`, `usePosts`, `usePost`, `useUpdatePost`, inbox and analytics hooks) and the
components: `ConnectAccounts`, `Composer`, `PostPreview`/`PreviewGrid`, `Calendar`, `Inbox`, `Analytics`, plus the small
`ui` primitives they share. Styling is Tailwind classes driven only by `--ze-*` variables from `./theme.css`, so a host
re-themes by overriding tokens. This is the source the shadcn registry in `apps/docs` ships.

Test with `pnpm --filter @zernio-elements/react test`.
