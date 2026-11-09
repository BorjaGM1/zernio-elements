import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Promise<Highlighter> | undefined;

export type Lang = "tsx" | "ts" | "bash" | "css" | "json";

/** Build-time syntax highlighting. One highlighter for the whole build, dual light/dark themes. */
export async function highlight(code: string, lang: Lang): Promise<string> {
  highlighter ??= createHighlighter({ themes: ["github-light", "github-dark"], langs: ["tsx", "ts", "bash", "css", "json"] });
  const h = await highlighter;
  return h.codeToHtml(code.trimEnd(), { lang, themes: { light: "github-light", dark: "github-dark" }, defaultColor: false });
}
