import { readFileSync } from "node:fs";
import path from "node:path";
import { parseTokens, type Token } from "./tokens";

/** Read at build time (pages using this are statically rendered). */
export function themeTokens(): Token[] {
  const file = path.join(process.cwd(), "../../packages/react/src/styles/theme.css");
  return parseTokens(readFileSync(file, "utf8"));
}
