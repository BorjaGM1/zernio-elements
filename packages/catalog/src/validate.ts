import { createSpecStreamCompiler, type Spec } from "@json-render/core";
import { catalog } from "./catalog";

export type CatalogSpec = Spec;

export type SpecCheck = { ok: true; spec: CatalogSpec } | { ok: false; errors: string[] };

const components = catalog.data.components as Record<string, { props: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } } }; slots: string[] }>;

/** Fields this catalog never accepts: every value must be a literal prop. */
const DYNAMIC_FIELDS = ["visible", "repeat", "on", "watch", "slots"] as const;

/**
 * Validate a spec against the catalog, strictly: known component types only, every prop parsed by its
 * zod schema, every child key resolvable, no cycles, no state or expressions. Only a spec that passes
 * this is ever rendered. (json-render's own catalog.validate checks the tree shape but not prop
 * values, so the per-component props check lives here.)
 */
export function validateCatalogSpec(input: unknown): SpecCheck {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Spec must be an object with root and elements."] };
  const raw = input as { root?: unknown; elements?: unknown; state?: unknown };
  if (typeof raw.root !== "string" || !raw.root) errors.push("root must be the key of the root element.");
  if (!raw.elements || typeof raw.elements !== "object") return { ok: false, errors: [...errors, "elements must be an object."] };
  if (raw.state !== undefined && raw.state !== null && Object.keys(raw.state as object).length > 0) errors.push("state is not supported: put data directly in props.");

  // Leaf elements may omit children; normalise so the structural check and the renderer agree.
  const elements: Spec["elements"] = {};
  for (const [key, el] of Object.entries(raw.elements as Record<string, unknown>)) {
    if (!el || typeof el !== "object") {
      errors.push(`${key}: element must be an object.`);
      continue;
    }
    const e = el as Record<string, unknown>;
    elements[key] = { ...(e as object), props: (e.props ?? {}) as Record<string, unknown>, children: (e.children ?? []) as string[] } as Spec["elements"][string];
  }
  const spec = { root: raw.root as string, elements } as Spec;

  const shape = catalog.validate(spec);
  if (!shape.success) {
    for (const i of shape.error?.issues ?? []) {
      const [, key, field] = i.path.map(String);
      if (field === "type") errors.push(`${key}: unknown component "${String((elements[key!] as { type?: unknown })?.type)}". Allowed: ${catalog.componentNames.join(", ")}.`);
      else errors.push(`${i.path.join(".")}: ${i.message}`);
    }
  }

  for (const [key, el] of Object.entries(elements)) {
    const def = components[el.type];
    if (!def) continue; // reported above
    for (const f of DYNAMIC_FIELDS) if ((el as unknown as Record<string, unknown>)[f] !== undefined) errors.push(`${key}: "${f}" is not supported in this catalog.`);
    const parsed = def.props.safeParse(el.props);
    if (!parsed.success) for (const i of parsed.error?.issues ?? []) errors.push(`${key} (${el.type}) ${i.path.map(String).join(".") || "props"}: ${i.message}`);
    if (!def.slots.length && el.children?.length) errors.push(`${key} (${el.type}) cannot have children.`);
    for (const c of el.children ?? []) if (!elements[c]) errors.push(`${key}: child "${c}" is not defined.`);
  }

  if (typeof raw.root === "string" && !elements[raw.root]) errors.push(`root "${raw.root}" is not defined.`);
  else if (!errors.length && hasCycle(spec)) errors.push("The element tree has a cycle.");

  return errors.length ? { ok: false, errors } : { ok: true, spec };
}

function hasCycle(spec: Spec): boolean {
  const seen = new Set<string>();
  const walk = (key: string, path: Set<string>): boolean => {
    if (path.has(key)) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    path.add(key);
    const cyclic = (spec.elements[key]?.children ?? []).some((c) => walk(c, path));
    path.delete(key);
    return cyclic;
  };
  return walk(spec.root, new Set());
}

/**
 * Compile model output into a spec. Accepts the JSONL patch stream the prompt asks for (tolerating a
 * stray code fence or a partial last line while streaming) or a whole spec as one JSON object.
 */
export function parseSpecText(text: string): Partial<CatalogSpec> {
  const body = text.replace(/^\s*```[a-z]*\s*$/gim, "").trim();
  if (body.startsWith("{") && !body.includes('"op"')) {
    try {
      return JSON.parse(body) as CatalogSpec;
    } catch {
      return {};
    }
  }
  const compiler = createSpecStreamCompiler<CatalogSpec>();
  // Only complete lines: a half-streamed line is applied on the next call.
  const complete = text.endsWith("\n") ? body + "\n" : body.slice(0, body.lastIndexOf("\n") + 1);
  compiler.push(complete);
  return compiler.getResult() as Partial<CatalogSpec>;
}

/** Parse the final model output (including its last line) and validate it. */
export function parseAndValidate(text: string): SpecCheck {
  return validateCatalogSpec(parseSpecText(text.endsWith("\n") ? text : text + "\n"));
}
