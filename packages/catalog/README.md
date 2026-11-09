# @zernio-elements/catalog

A json-render catalog of 11 components with zod prop schemas, so a model can compose a view without inventing UI.
`catalogPrompt()` and `catalogJsonSchema()` constrain the model; `validateCatalogSpec` / `parseAndValidate` reject
unknown components and bad prop values before anything renders; `CatalogView` renders only a valid spec; `EXAMPLES`
are labelled example specs. The `./server` entry exports the prompt, validation and examples without React, for API
routes and the MCP server.

Test with `pnpm --filter @zernio-elements/catalog test` (`catalog.test.ts`).
