# @zernio-elements/rules

Zero-dependency TypeScript: what each platform allows and how a post adapts to it. `SPECS` holds per-platform limits
(text length and count mode, feed truncation, title, media and hashtag rules); `validate`, `validatePlatform`, `adapt`,
`applyFix` and `splitThread` turn one draft into per-platform results with fixes; `countText` matches Zernio's counting
(UTF-16, X URL weighting); `toCreatePostBody` and `validationBody` build the exact Zernio request bodies. `mcp.ts` is
the MCP App contract: `buildPreview`, `hashPayload`, resource URIs and tool input/output types.

Test with `pnpm --filter @zernio-elements/rules test`. `drift.test.ts` runs against the live Zernio API when
`ZERNIO_API_KEY` is set and is skipped otherwise.
