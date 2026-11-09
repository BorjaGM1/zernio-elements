import type { CountMode } from "./types";

const URL_RE = /https?:\/\/[^\s]+/g;
const HASHTAG_RE = /(^|\s)#([\p{L}\p{N}_]+)/gu;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export function graphemes(text: string): string[] {
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** X weighting (simplified twitter-text v3): these ranges weigh 1, everything else 2. */
function twitterWeight(grapheme: string): number {
  const cp = grapheme.codePointAt(0) ?? 0;
  if (grapheme.length > 2) return 2; // emoji sequences
  if (
    (cp >= 0 && cp <= 4351) ||
    (cp >= 8192 && cp <= 8205) ||
    (cp >= 8208 && cp <= 8223) ||
    (cp >= 8242 && cp <= 8247)
  ) {
    return 1;
  }
  return 2;
}

export function countText(text: string, mode: CountMode): number {
  if (mode === "graphemes") return graphemes(text).length;
  if (mode === "chars") return text.length;
  // twitter: every URL counts as 23 regardless of length
  let weighted = 0;
  let zernio = 0;
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    const before = text.slice(last, idx);
    weighted += graphemes(before).reduce((n, g) => n + twitterWeight(g), 0) + 23;
    zernio += before.length + 23;
    last = idx + m[0].length;
  }
  const rest = text.slice(last);
  weighted += graphemes(rest).reduce((n, g) => n + twitterWeight(g), 0);
  zernio += rest.length;
  return Math.max(weighted, zernio);
}

export function extractHashtags(text: string): string[] {
  return Array.from(text.matchAll(HASHTAG_RE), (m) => m[2] ?? "").filter(Boolean);
}

export function extractLinks(text: string): string[] {
  return Array.from(text.matchAll(URL_RE), (m) => m[0]);
}

/** Cut at a grapheme boundary, preferring the last word break. */
export function truncateAt(text: string, max: number): { visible: string; truncated: boolean } {
  const g = graphemes(text);
  if (g.length <= max) return { visible: text, truncated: false };
  let cut = g.slice(0, max).join("");
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return { visible: cut.trimEnd(), truncated: true };
}

/**
 * Split text into thread segments that each fit `max` under `mode`.
 * Prefers paragraph breaks, then sentence ends, then word breaks. Adds " 1/n" counters when numbered.
 */
export function splitThread(
  text: string,
  max: number,
  mode: CountMode,
  { numbered = true }: { numbered?: boolean } = {},
): string[] {
  const clean = text.trim();
  if (!clean) return [""];
  if (countText(clean, mode) <= max) return [clean];

  // Reserve room for " 99/99"
  const budget = numbered ? max - 6 : max;
  const units = clean
    .split(/\n{2,}/)
    // Sentence ends are a terminator followed by whitespace, so URLs, decimals and "e.g." stay intact.
    .flatMap((p) => p.split(/(?<=[.!?]["')\]]*)\s+/))
    .map((s) => s.trim())
    .filter(Boolean);

  // Fewest posts that fit, then the smallest soft cap that still needs no more posts than that,
  // so a thread reads as balanced posts instead of one full post and a stub.
  const pack = (cap: number) => packUnits(units, cap, budget, mode);
  let out = pack(budget);
  if (out.length > 1) {
    let lo = Math.ceil(countText(units.join(" "), mode) / out.length);
    let hi = budget;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (pack(mid).length <= out.length) hi = mid;
      else lo = mid + 1;
    }
    out = pack(hi);
  }

  if (!numbered || out.length < 2) return out;
  return out.map((s, i) => `${s} ${i + 1}/${out.length}`);
}

/**
 * Greedy packing of sentence units under a soft `cap`. A sentence longer than the cap but within the hard
 * `budget` gets its own post; only sentences over the budget are split by words.
 */
function packUnits(units: string[], cap: number, budget: number, mode: CountMode): string[] {
  const out: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) out.push(current.trim());
    current = "";
  };
  for (const unit of units) {
    const candidate = current ? `${current} ${unit}` : unit;
    if (countText(candidate, mode) <= cap) {
      current = candidate;
      continue;
    }
    push();
    if (countText(unit, mode) <= budget) {
      current = unit;
      continue;
    }
    // Sentence alone is too long: fall back to words.
    for (const word of unit.split(/\s+/)) {
      const c = current ? `${current} ${word}` : word;
      if (countText(c, mode) <= budget) current = c;
      else {
        push();
        current = word;
      }
    }
  }
  push();
  return out;
}
