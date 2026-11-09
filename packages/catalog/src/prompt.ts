import { catalog } from "./catalog";

export interface CatalogPromptOptions {
  /** Replaces the opening line of the system prompt. */
  system?: string;
  /** Extra numbered rules appended after the catalog's own. */
  rules?: string[];
  /**
   * Facts the view may use (tool results, fixtures). Serialised as JSON under a DATA heading; the
   * prompt tells the model to use only these numbers.
   */
  data?: unknown;
}

/**
 * The system prompt that constrains a model to this catalog: output format (JSONL patches), every
 * component with its prop types and description, and the rules. Generated from the zod schemas, so it
 * never drifts from what validateCatalogSpec accepts.
 */
export function catalogPrompt(options: CatalogPromptOptions = {}): string {
  const base = catalog.prompt({ ...(options.system ? { system: options.system } : {}), ...(options.rules ? { customRules: options.rules } : {}) });
  return options.data === undefined ? base : `${base}\n\nDATA (the only facts you may use):\n${JSON.stringify(options.data, null, 2)}`;
}

/** JSON Schema of the spec, for hosts that prefer structured output over JSONL. */
export const catalogJsonSchema = (): object => catalog.jsonSchema();
