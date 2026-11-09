/** Parse the --ze-* tokens out of packages/react/src/styles/theme.css. Pure, so the registry script can use it too. */
export interface Token {
  name: string;
  value: string;
}

export function parseTokens(css: string): Token[] {
  const out: Token[] = [];
  for (const m of css.matchAll(/(--ze-[\w-]+)\s*:\s*([^;]+);/g)) {
    out.push({ name: m[1] ?? "", value: (m[2] ?? "").trim() });
  }
  return out;
}
