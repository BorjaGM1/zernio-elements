import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { CatalogView, EXAMPLES, catalog, catalogPrompt, parseAndValidate, parseSpecText, validateCatalogSpec, type CatalogSpec } from "./index";

const clone = (s: CatalogSpec): CatalogSpec => JSON.parse(JSON.stringify(s));

describe("examples", () => {
  it.each(EXAMPLES.map((e) => [e.id, e] as const))("%s validates against the catalog", (_, e) => {
    const r = validateCatalogSpec(e.spec);
    expect(r.ok ? [] : r.errors).toEqual([]);
  });

  const expected: Record<string, string[]> = {
    "weekly-report": ["Week of Nov 2 to 8", "35.6k", "Peak 9,860 on Nov 5", "Instagram", "Thursday&#x27;s menu post carried the week"],
    // "Thread · 2 posts" comes from the rules engine (splitThread), not from the spec.
    "launch-checklist": ["Autumn menu launch", "Reconnect Instagram", "2 of 5 done", "Thread · 2 posts", "Preview only", "Bodega Norte"],
    "account-health": ["Account health", "@bodeganorte.bsky.social", "Needs reconnecting", "Paused", "Not connected", "3 of 6 healthy"],
  };

  it.each(EXAMPLES.map((e) => [e.id, e] as const))("%s renders with the real components", (id, e) => {
    const html = renderToString(createElement(CatalogView, { spec: e.spec }));
    expect(html).not.toContain("match the catalog");
    for (const text of expected[id]!) expect(html).toContain(text);
  });
});

describe("rejects", () => {
  const base = () => clone(EXAMPLES[0]!.spec);

  it("an unknown component", () => {
    const s = base();
    s.elements.totals!.type = "Iframe";
    const r = validateCatalogSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/unknown component "Iframe"/);
  });

  it("a bad platform id", () => {
    const s = base();
    (s.elements.breakdown!.props.rows as Array<{ platform: string }>)[0]!.platform = "myspace";
    expect(validateCatalogSpec(s).ok).toBe(false);
  });

  it("a negative number", () => {
    const s = base();
    (s.elements.totals!.props.items as Array<{ value: number }>)[0]!.value = -5;
    const r = validateCatalogSpec(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/totals \(StatTiles\) items\.0\.value/);
  });

  it("over-long strings, missing children, children on leaves and state expressions", () => {
    const long = base();
    long.elements.page!.props.title = "x".repeat(200);
    expect(validateCatalogSpec(long).ok).toBe(false);

    const missing = base();
    missing.elements.page!.children = ["totals", "ghost"];
    expect(validateCatalogSpec(missing).ok).toBe(false);

    const leaf = base();
    leaf.elements.totals!.children = ["daily"];
    expect(validateCatalogSpec(leaf).ok).toBe(false);

    const dynamic = base();
    dynamic.elements.page!.props.title = { $state: "/title" } as unknown as string;
    expect(validateCatalogSpec(dynamic).ok).toBe(false);

    const visible = base() as CatalogSpec & { elements: Record<string, { visible?: unknown }> };
    visible.elements.page!.visible = { $state: "/x" };
    expect(validateCatalogSpec(visible).ok).toBe(false);
  });

  it("a cycle", () => {
    const s = base();
    s.elements.daily!.children = ["page"];
    // Section accepts children, so only the cycle check catches this.
    const r = validateCatalogSpec(s);
    expect(r.ok).toBe(false);
  });

  it("and CatalogView renders the errors, never the components", () => {
    const s = base();
    s.elements.totals!.type = "Script";
    const html = renderToString(createElement(CatalogView, { spec: s }));
    expect(html).toContain("match the catalog");
    expect(html).not.toContain("Week of Nov 2 to 8");
  });
});

describe("model output", () => {
  const jsonl = (spec: CatalogSpec) =>
    [JSON.stringify({ op: "add", path: "/root", value: spec.root }), ...Object.entries(spec.elements).map(([k, v]) => JSON.stringify({ op: "add", path: `/elements/${k}`, value: v }))].join("\n");

  it("compiles a JSONL patch stream, ignoring a partial last line while streaming", () => {
    const text = jsonl(EXAMPLES[2]!.spec);
    expect(parseAndValidate(text).ok).toBe(true);
    const partial = parseSpecText(text.slice(0, text.length - 20));
    expect(Object.keys(partial.elements ?? {}).length).toBe(Object.keys(EXAMPLES[2]!.spec.elements).length - 1);
  });

  it("tolerates code fences and a whole-spec JSON object", () => {
    expect(parseAndValidate("```jsonl\n" + jsonl(EXAMPLES[1]!.spec) + "\n```").ok).toBe(true);
    expect(parseAndValidate(JSON.stringify(EXAMPLES[0]!.spec)).ok).toBe(true);
  });
});

describe("prompt", () => {
  it("lists every component, the platform ids and the data", () => {
    const p = catalogPrompt({ data: { hello: "world" } });
    for (const name of catalog.componentNames) expect(p).toContain(`- ${name}:`);
    expect(p).toContain('"twitter"');
    expect(p).toContain("JSONL");
    expect(p).toContain('"hello": "world"');
    // The stock prompt teaches state and actions; ours must not.
    expect(p).not.toContain("pushState");
  });
});

describe("AccountList without a handle", () => {
  it("accepts a not-connected platform with no handle and shows the platform name, not an invented @handle", () => {
    const spec = {
      root: "a",
      elements: {
        a: { type: "AccountList", props: { accounts: [{ platform: "threads", health: "not_connected" }, { platform: "bluesky", handle: "demo.bsky.social", health: "connected" }] }, children: [] },
      },
    };
    const check = validateCatalogSpec(spec);
    expect(check.ok).toBe(true);
    const html = renderToString(createElement(CatalogView, { spec }));
    expect(html).toContain("Threads");
    expect(html).not.toContain("@Threads");
    expect(html).toContain("@demo.bsky.social");
  });
});
