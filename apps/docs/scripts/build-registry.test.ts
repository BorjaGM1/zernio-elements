import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COMPONENTS } from "../lib/catalog.ts";
import { buildRegistry, SCHEMA_INDEX, SCHEMA_ITEM, type RegistryItem } from "./build-registry.ts";

const SITE = "https://docs.example.test";
const TYPES = new Set(["registry:lib", "registry:hook", "registry:component", "registry:theme", "registry:file", "registry:ui", "registry:style"]);

let dir: string;
let items: RegistryItem[];

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "zernio-registry-"));
  buildRegistry({ outDir: dir, siteUrl: SITE });
  const rDir = path.join(dir, "r");
  items = readdirSync(rDir)
    .filter((f) => f !== "registry.json")
    .map((f) => JSON.parse(readFileSync(path.join(rDir, f), "utf8")) as RegistryItem);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("shadcn registry", () => {
  it("every item parses and follows the registry-item schema", () => {
    expect(items.length).toBeGreaterThan(5);
    for (const item of items) {
      expect(item.$schema).toBe(SCHEMA_ITEM);
      expect(item.name).toMatch(/^[a-z0-9-]+$/);
      expect(TYPES.has(item.type)).toBe(true);
      expect(item.description).toBeTruthy();
      for (const f of item.files ?? []) {
        expect(TYPES.has(f.type)).toBe(true);
        expect(f.target).toBeTruthy();
        expect(f.content.length).toBeGreaterThan(0);
      }
    }
  });

  it("every registryDependency resolves to an existing item", () => {
    const names = new Set(items.map((i) => i.name));
    for (const item of items) {
      for (const dep of item.registryDependencies ?? []) {
        expect(dep.startsWith(`${SITE}/r/`)).toBe(true);
        expect(names.has(path.basename(dep, ".json"))).toBe(true);
      }
    }
  });

  it("no file still imports internal packages or relative paths", () => {
    for (const item of items) {
      for (const f of item.files ?? []) {
        expect(f.content, `${item.name}: ${f.path}`).not.toContain("@zernio-elements/");
        expect(f.content, `${item.name}: ${f.path}`).not.toMatch(/from\s*["']\.\.?\//);
      }
    }
  });

  it("every @/ import points at a file some item installs", () => {
    const targets = new Set(
      items.flatMap((i) => i.files ?? []).map((f) => `@/${f.target.replace(/\.(tsx?)$/, "").replace(/\/index$/, "")}`),
    );
    for (const item of items) {
      for (const f of item.files ?? []) {
        for (const m of f.content.matchAll(/from\s*["'](@\/[^"']+)["']/g)) expect(targets.has(m[1] ?? ""), `${f.path} -> ${m[1]}`).toBe(true);
      }
    }
  });

  it("npm dependencies are real packages only", () => {
    const deps = new Set(items.flatMap((i) => i.dependencies ?? []));
    expect(deps.has("@tanstack/react-query")).toBe(true);
    for (const d of deps) expect(d).not.toMatch(/^(@\/|@zernio-elements|react$|react-dom$|next$)/);
  });

  it("ships the theme tokens and the Next route", () => {
    const theme = items.find((i) => i.name === "zernio-theme");
    expect(theme?.cssVars?.light["ze-primary"]).toBeTruthy();
    const server = items.find((i) => i.name === "zernio-server");
    expect(server?.files?.some((f) => f.type === "registry:file" && f.target === "app/api/zernio/[...path]/route.ts")).toBe(true);
  });

  it("every documented component has a registry item, and the index lists them all", () => {
    const names = new Set(items.map((i) => i.name));
    for (const c of COMPONENTS) expect(names.has(c.registry), c.slug).toBe(true);
    const index = JSON.parse(readFileSync(path.join(dir, "r", "registry.json"), "utf8")) as { $schema: string; items: Array<{ name: string }> };
    expect(index.$schema).toBe(SCHEMA_INDEX);
    expect(index.items.map((i) => i.name).sort()).toEqual([...names].sort());
  });

  it("writes llms.txt with install URLs", () => {
    const llms = readFileSync(path.join(dir, "llms.txt"), "utf8");
    expect(llms).toContain(`${SITE}/r/composer.json`);
    expect(llms).toContain(`${SITE}/agents/mcp-app`);
    expect(llms).toContain(`${SITE}/agents/generative-ui`);
  });
});
