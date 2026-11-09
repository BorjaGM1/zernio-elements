/**
 * The json-render catalog: which components an agent may use and the exact props each accepts.
 * Data in, view out: no component fetches anything, so an agent composes views from tool results.
 *
 * This file is React-free on purpose (zod + json-render core only) so servers can build the prompt
 * and validate specs without pulling in the renderer.
 */
import { defineCatalog, defineSchema, type PromptContext } from "@json-render/core";
import { schema as reactSchema } from "@json-render/react/schema";
import { PLATFORM_IDS } from "@zernio-elements/rules";
import { z } from "zod";

const platform = z.enum(PLATFORM_IDS).describe("Zernio platform id");
const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().nonnegative();
const title = text(80).optional().describe("Heading shown above the block");

const media = z
  .object({
    url: z.url().max(2000),
    type: z.enum(["image", "video"]),
    alt: text(300).optional(),
    width: z.number().int().positive().max(10_000).optional(),
    height: z.number().int().positive().max(10_000).optional(),
    durationSec: z.number().positive().max(36_000).optional(),
  })
  .describe("Image or video attached to the post");

const author = z.object({ name: text(80), handle: text(60).regex(/^[^\s@]+$/, "Handle without @ or spaces") });

const post = {
  content: z.string().max(10_000).describe("Post text, exactly as it would be published"),
  title: text(300).optional().describe("Title, for YouTube, Pinterest and Reddit"),
  media: z.array(media).max(10).optional(),
  author: author.optional().describe("Account shown as the author"),
};

export const HEALTH = ["connected", "needs_reconnect", "paused", "attention", "not_connected"] as const;
export const TONES = ["neutral", "info", "success", "warning", "danger"] as const;

/**
 * The React renderer's spec shape, with our own prompt: the stock prompt teaches state, repeat and
 * actions, which this catalog deliberately doesn't use (every value is a literal prop).
 */
const schema = defineSchema(() => reactSchema.definition, {
  promptTemplate: (ctx) => promptTemplate(ctx as PromptContext<CatalogData>),
});

type CatalogData = { components: Record<string, { props: z.ZodType; description: string; slots?: string[] }> };

function promptTemplate({ catalog, formatZodType, options }: PromptContext<CatalogData>): string {
  const components = Object.entries(catalog.components)
    .map(
      ([name, c]) =>
        `- ${name}: ${formatZodType(c.props)} - ${c.description}${c.slots?.length ? " [accepts children]" : " [leaf: children must be []]"}`,
    )
    .join("\n");
  return [
    options.system ?? "You compose read-only views for a social media team out of Zernio Elements components.",
    "",
    "OUTPUT FORMAT: JSONL, one RFC 6902 JSON Patch operation per line, nothing else. No prose, no markdown, no code fences.",
    "Line 1 sets the root key, then one line per element, parents before children, so the view streams top-down:",
    '{"op":"add","path":"/root","value":"page"}',
    '{"op":"add","path":"/elements/page","value":{"type":"Stack","props":{"title":"Last 7 days"},"children":["totals","note"]}}',
    '{"op":"add","path":"/elements/totals","value":{"type":"StatTiles","props":{"items":[{"label":"Impressions","value":48210},{"label":"Posts","value":9}]},"children":[]}}',
    '{"op":"add","path":"/elements/note","value":{"type":"Callout","props":{"title":"Thursday carried the week","tone":"info"},"children":[]}}',
    "",
    `AVAILABLE COMPONENTS (${Object.keys(catalog.components).length}). These are the only types that exist; anything else is rejected:`,
    components,
    "",
    "RULES:",
    "1. Every element is {type, props, children}. children lists child element keys; leaf components use [].",
    "2. The root is a Stack. Group related blocks in a Section; put blocks side by side with a Grid.",
    "3. Props are literal JSON values. Do not use state, repeat, visible, on, watch or any $-expression: they are rejected.",
    "4. Use only facts and numbers from the DATA section or the user's message. If a number is missing, leave the block out instead of inventing it.",
    "5. Platform ids are lowercase Zernio ids (twitter, instagram, linkedin, bluesky...). Counts are non-negative integers. Dates are YYYY-MM-DD.",
    "6. PostPreview and PreviewGrid compute truncation, thread splits and blocking issues themselves: pass the post exactly as written, never shorten it.",
    "7. Keep to what the person asked for, usually 3 to 8 blocks. Titles are short and specific, sentence case, no emojis.",
    ...(options.customRules ?? []).map((r, i) => `${i + 8}. ${r}`),
  ].join("\n");
}

export const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        title,
        description: text(240).optional(),
        gap: z.enum(["sm", "md", "lg"]).optional(),
      }),
      slots: ["default"],
      description: "Vertical stack of children. Use as the root of a view. Optional page title and one-line description.",
    },
    Grid: {
      props: z.object({
        title,
        columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).describe("Columns on wide screens; collapses to 1 on phones"),
      }),
      slots: ["default"],
      description: "Responsive grid of children, for side-by-side blocks of similar height.",
    },
    Section: {
      props: z.object({ title: text(80), description: text(240).optional() }),
      slots: ["default"],
      description: "A titled card that groups related children. The main building block of a report.",
    },
    Callout: {
      props: z.object({ title: text(100), body: text(600).optional(), tone: z.enum(TONES) }),
      slots: [],
      description: "Short highlighted message: a finding, a warning or a next step. Keep body to one or two sentences.",
    },
    StatTiles: {
      props: z.object({
        title,
        items: z
          .array(
            z.object({
              label: text(40),
              value: z.number().nonnegative().max(1e12),
              format: z.enum(["number", "percent"]).optional().describe("percent renders value as 4.2%"),
              change: z.number().min(-1000).max(1000).optional().describe("Change vs previous period, in percent"),
            }),
          )
          .min(1)
          .max(6),
      }),
      slots: [],
      description: "Row of headline numbers (totals for a period). 2 to 4 items read best.",
    },
    DailyBars: {
      props: z.object({
        title,
        metric: text(40).describe("What the bars count, e.g. Impressions"),
        days: z
          .array(z.object({ date: z.iso.date().describe("YYYY-MM-DD"), value: count }))
          .min(2)
          .max(92),
      }),
      slots: [],
      description: "One bar per day for a single metric, oldest first. The peak day is highlighted.",
    },
    PlatformBreakdown: {
      props: z.object({
        title,
        metric: text(40),
        rows: z
          .array(z.object({ platform, value: count, posts: count.optional() }))
          .min(1)
          .max(PLATFORM_IDS.length),
      }),
      slots: [],
      description: "Compare one metric across platforms, as bars with each platform's share of the total.",
    },
    AccountList: {
      props: z.object({
        title,
        accounts: z
          .array(
            z.object({
              platform,
              handle: text(60).optional().describe("The account's handle. Omit for platforms that are not connected; never use the platform name."),
              health: z.enum(HEALTH),
              detail: text(140).optional().describe("Why it needs attention, or what to do next"),
            }),
          )
          .min(1)
          .max(30),
      }),
      slots: [],
      description: "Connected social accounts and their health. Use not_connected for platforms the brand wants but has not connected.",
    },
    Checklist: {
      props: z.object({
        title,
        items: z
          .array(z.object({ label: text(120), done: z.boolean(), detail: text(160).optional() }))
          .min(1)
          .max(20),
      }),
      slots: [],
      description: "Steps with done or pending state, e.g. what is left before a launch.",
    },
    PostPreview: {
      props: z.object({
        platform,
        ...post,
        previewOnly: z.boolean().optional().describe("True when no account is connected for this platform"),
      }),
      slots: [],
      description:
        "How one post will look on one platform: feed cut-off, crop, thread split and blocking issues are computed by Zernio's rules engine, not by you.",
    },
    PreviewGrid: {
      props: z.object({
        ...post,
        platforms: z.array(platform).min(1).max(PLATFORM_IDS.length),
        previewOnly: z.array(platform).max(PLATFORM_IDS.length).optional().describe("Platforms without a connected account"),
      }),
      slots: [],
      description: "The same post previewed on several platforms at once. Prefer this over several PostPreview blocks.",
    },
  },
  actions: {},
});

export type CatalogComponent = (typeof catalog.componentNames)[number];
