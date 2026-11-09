// React-free entry for servers (e.g. the MCP render_view tool): build the prompt and validate specs.
export { catalogPrompt, catalogJsonSchema, type CatalogPromptOptions } from "./prompt";
export { validateCatalogSpec, parseSpecText, parseAndValidate, type CatalogSpec, type SpecCheck } from "./validate";
export { EXAMPLES, EXAMPLE_DATA, type CatalogExample } from "./examples";
