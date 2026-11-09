/**
 * The single source of truth for the docs: nav, component pages, props tables, hook pages,
 * rules-engine reference, and llms.txt. To document a new component, add one entry to COMPONENTS.
 *
 * Props are written by hand from packages/react/src. When a component API changes, edit its entry here.
 * This file must stay plain data (type-only imports) because scripts/build-registry.ts imports it
 * with Node's type stripping.
 */

export interface PropDef {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

export interface ComponentDoc {
  slug: string;
  /** Export name in @zernio-elements/react. Used for the generic live preview. */
  name: string;
  /** Registry item that ships it (public/r/<registry>.json). */
  registry: string;
  description: string;
  props: PropDef[];
  usage: string;
  /** JSON-serialisable props for the generic preview, when there is no custom preview. */
  previewProps?: Record<string, unknown>;
  notes?: string[];
}

export interface HookDoc {
  slug: string;
  name: string;
  description: string;
  signature: string;
  endpoints: string[];
  returns: PropDef[];
  usage: string;
}

export interface RulesFnDoc {
  name: string;
  signature: string;
  description: string;
  usage: string;
}

const SAMPLE_POST = {
  content:
    "We just opened summer availability for every listing in Cartagena. Book direct and skip the platform fees. #travel",
  media: [],
};

export const COMPONENTS: ComponentDoc[] = [
  {
    slug: "connect-accounts",
    name: "ConnectAccounts",
    registry: "connect-accounts",
    description: "Connect and reconnect social accounts through Zernio Connect, co-branded with your product.",
    props: [
      {
        name: "platforms",
        type: "readonly PlatformId[]",
        default: "9 OAuth publishing platforms",
        description: "Which publishing platforms to offer, in order.",
      },
      {
        name: "redirectUrl",
        type: "string",
        default: "current page",
        description: "Where Zernio sends the user after OAuth (redirect_url). The component reads ?connected= on return and refreshes.",
      },
      {
        name: "branding",
        type: "{ brandName?: string; logoUrl?: string; primaryColor?: string }",
        description: "Puts your name, logo and color on Zernio's welcome screen (sends welcome=true, which brandName requires).",
      },
      { name: "headless", type: "boolean", description: "Raw OAuth result to redirectUrl so you render your own page/organization selector." },
      { name: "(Telegram)", type: "access code", description: "Telegram has no OAuth: the component shows Zernio's code and bot, then polls PATCH /v1/connect/telegram until the channel is connected." },
      { name: "oauthAppId", type: "string", description: "Use your own OAuth app, so the consent screen shows your app." },
      { name: "title", type: "string", default: '"Connected accounts"', description: "Section heading." },
    ],
    usage: `import { ConnectAccounts } from "@/components/zernio/connect-accounts";

export function Settings() {
  return (
    <ConnectAccounts
      platforms={["twitter", "instagram", "linkedin"]}
      branding={{ brandName: "Hostly", primaryColor: "#c8502a" }}
    />
  );
}`,
    previewProps: { platforms: ["twitter", "instagram", "linkedin", "tiktok", "youtube", "pinterest"] },
  },
  {
    slug: "composer",
    name: "Composer",
    registry: "composer",
    description: "One composer for every platform, with live per-platform validation and previews.",
    props: [
      {
        name: "controller",
        type: "ComposerController",
        default: "internal useComposer()",
        description: "State from useComposer(). Pass your own to drive the composer from outside, e.g. from an AI agent.",
      },
      { name: "showPreviews", type: "boolean", default: "true", description: "Render the PreviewGrid next to the editor." },
      { name: "author", type: "{ name: string; handle: string; avatar?: string }", description: "Who the previews show as the poster." },
      {
        name: "onPublished",
        type: "(post: Post) => void",
        description: "Called with the created post after POST /v1/posts succeeds (also for scheduled posts).",
      },
      { name: "placeholder", type: "string", description: "Textarea placeholder." },
      {
        name: "previewWithoutAccount",
        type: "readonly PlatformId[]",
        default: "[]",
        description: "Platforms the user can preview with no connected account. Shown under \"Preview only\": never published, never blocking.",
      },
    ],
    usage: `import { Composer } from "@/components/zernio/composer";

export function NewPost() {
  return <Composer author={{ name: "Casa Azul", handle: "casaazul" }} onPublished={(p) => console.log(p._id)} />;
}`,
    notes: [
      "Validation runs locally on every keystroke. Publish also calls POST /v1/tools/validate/post as the authoritative check.",
      "Issues with a fix (shorten, add title, drop hashtags, remove extra media) get a one-click button.",
      "Uploads go through POST /v1/media/presign and a direct PUT to storage; width, height and duration are read in the browser for validation.",
      "After publishing, each platform's status is polled until it settles, with a link to the live post.",
    ],
  },
  {
    slug: "post-preview",
    name: "PostPreview",
    registry: "post-preview",
    description: "How a post will look in one platform's feed: truncation, crops, threads and titles.",
    props: [
      { name: "post", type: "ComposerPost", required: true, description: "Composer state: content, optional title, media, per-platform overrides." },
      { name: "platform", type: "PlatformId", required: true, description: "Which platform to render." },
      {
        name: "author",
        type: "{ name: string; handle: string; avatar?: string }",
        default: '{ name: "Your Brand", handle: "yourbrand" }',
        description: "Header shown on the preview card.",
      },
    ],
    usage: `import { PostPreview } from "@/components/zernio/post-preview";

<PostPreview platform="linkedin" post={{ content: draft, media: [] }} author={{ name: "Hostly", handle: "hostly" }} />`,
    previewProps: { post: SAMPLE_POST, platform: "instagram", author: { name: "Hostly", handle: "hostly" } },
    notes: ["Layouts are faithful approximations with neutral styling. No platform logos or copied UI."],
  },
  {
    slug: "preview-grid",
    name: "PreviewGrid",
    registry: "post-preview",
    description: "A responsive grid of PostPreview cards, one per selected platform.",
    props: [
      { name: "post", type: "ComposerPost", required: true, description: "The post to preview." },
      { name: "platforms", type: "readonly PlatformId[]", required: true, description: "Platforms to render, in order." },
      { name: "author", type: "{ name: string; handle: string; avatar?: string }", description: "Who the previews show as the poster." },
    ],
    usage: `import { PreviewGrid } from "@/components/zernio/post-preview";

<PreviewGrid post={{ content: draft, media: [] }} platforms={["twitter", "linkedin", "threads"]} />`,
    previewProps: { post: SAMPLE_POST, platforms: ["twitter", "linkedin", "threads"] },
  },
  {
    slug: "calendar",
    name: "Calendar",
    registry: "calendar",
    description: "A week of scheduled and published posts, with links to live posts. Drag a scheduled post to another day to reschedule it.",
    props: [{ name: "days", type: "number", default: "7", description: "Number of day columns, starting yesterday. Arrows page by this many days." }],
    usage: `import { Calendar } from "@/components/zernio/calendar";

<Calendar days={7} />`,
  },
  {
    slug: "inbox",
    name: "Inbox",
    registry: "inbox",
    description: "Unified DMs across platforms: conversation list, thread and reply box. Replies go out from the account that received the message.",
    props: [],
    usage: `import { Inbox } from "@/components/zernio/inbox";

<Inbox />`,
  },
  {
    slug: "analytics",
    name: "Analytics",
    registry: "analytics",
    description: "Headline totals and a daily bar chart for the tenant's profile, from GET /v1/analytics/daily-metrics.",
    props: [{ name: "days", type: "number", default: "14", description: "How many days back to show." }],
    usage: `import { Analytics } from "@/components/zernio/analytics";

<Analytics days={30} />`,
    notes: ["Needs Zernio's analytics add-on. Without it the component shows Zernio's 402 message instead of a chart."],
  },
];

const QUERY_RESULT = (t: string): PropDef => ({
  name: "data",
  type: t,
  description: "TanStack Query result. isLoading, error and refetch are available as usual.",
});

export const HOOKS: HookDoc[] = [
  {
    slug: "use-composer",
    name: "useComposer",
    description: "Composer state, live validation on every keystroke, and publish.",
    signature: "function useComposer(initial?: Partial<ComposerPost>): ComposerController",
    endpoints: ["POST /v1/tools/validate/post", "POST /v1/posts"],
    returns: [
      { name: "post", type: "ComposerPost", description: "Current content, title, media and overrides." },
      { name: "setContent", type: "(content: string) => void", description: "Replace the base text." },
      { name: "setTitle", type: "(title: string) => void", description: "Title for YouTube, Reddit and Pinterest." },
      { name: "addMedia", type: "(m: MediaInput) => void", description: "Attach an image or video by URL." },
      { name: "removeMedia", type: "(url: string) => void", description: "Detach media by URL." },
      { name: "applyFix", type: "(issue: Issue) => void", description: "Apply an issue's one-click fix (truncate, add-title, drop-hashtags, remove-extra-media)." },
      { name: "setOverride", type: "(platform: PlatformId, content?: string) => void", description: "Per-platform text that replaces the base text." },
      { name: "targets", type: "Target[]", description: "Selected accounts." },
      { name: "toggleTarget", type: "(t: Target) => void", description: "Select or deselect an account." },
      { name: "setTargets", type: "(t: Target[]) => void", description: "Replace the selection." },
      { name: "platforms", type: "PlatformId[]", description: "Platforms of the selected targets." },
      { name: "validation", type: "ValidationResult", description: "Issues for every selected platform, recomputed on change." },
      { name: "publish", type: "UseMutationResult<PublishResult>", description: "mutate(schedule?) validates with Zernio, then creates the post. Resolves to { post, warnings }." },
      { name: "reset", type: "() => void", description: "Clear the draft." },
    ],
    usage: `const c = useComposer({ content: "Hello" });

c.toggleTarget({ platform: "twitter", accountId: "acc_x" });
c.validation.issues; // [{ platform: "twitter", severity: "info", code: "text_will_be_threaded", ... }]
await c.publish.mutateAsync({ scheduledFor: "2026-11-10T09:00:00Z" });`,
  },
  {
    slug: "use-accounts",
    name: "useAccounts",
    description: "Connected social accounts for the current tenant.",
    signature: "function useAccounts(): UseQueryResult<Account[]>",
    endpoints: ["GET /v1/accounts"],
    returns: [QUERY_RESULT("Account[]")],
    usage: `const { data: accounts = [] } = useAccounts();

accounts.map((a) => a.platform); // ["twitter", "instagram", ...]`,
  },
  {
    slug: "use-posts",
    name: "usePosts",
    description: "Scheduled, published and draft posts for the current tenant.",
    signature: "function usePosts(): UseQueryResult<Post[]>",
    endpoints: ["GET /v1/posts"],
    returns: [QUERY_RESULT("Post[]")],
    usage: `const { data: posts = [] } = usePosts();
const upcoming = posts.filter((p) => p.status === "scheduled");`,
  },
  {
    slug: "use-post",
    name: "usePost",
    description: "One post, polled every 2 seconds until every platform has published or failed. Use it to show live links after publishing.",
    signature: "function usePost(id: string | null): UseQueryResult<Post | null>",
    endpoints: ["GET /v1/posts/{postId}"],
    returns: [QUERY_RESULT("Post | null")],
    usage: `const { data: post } = usePost(publishedId);

post?.platforms?.map((t) => [t.platform, t.status, t.platformPostUrl]);`,
  },
  {
    slug: "use-media-upload",
    name: "useMediaUpload",
    description: "Upload a File through Zernio's presigned URLs. The API key never reaches the browser; the bytes go straight to storage.",
    signature: "function useMediaUpload(): UseMutationResult<MediaInput, Error, File>",
    endpoints: ["POST /v1/media/presign", "PUT <uploadUrl>"],
    returns: [{ name: "mutateAsync", type: "(file: File) => Promise<MediaInput>", description: "Resolves to { url, type, width, height, durationSec } ready for addMedia()." }],
    usage: `const upload = useMediaUpload();
const c = useComposer();

<input type="file" onChange={async (e) => c.addMedia(await upload.mutateAsync(e.target.files![0]!))} />`,
  },
  {
    slug: "use-inbox",
    name: "useInbox / useMessages",
    description: "Conversation list, and the messages of one conversation with a send mutation.",
    signature: `function useInbox(): UseQueryResult<Conversation[]>
function useMessages(conversation: { id: string; accountId: string } | null): UseQueryResult<Message[]> & { send: UseMutationResult }`,
    endpoints: [
      "GET /v1/inbox/conversations",
      "GET /v1/inbox/conversations/{id}/messages",
      "POST /v1/inbox/conversations/{id}/messages",
    ],
    returns: [
      QUERY_RESULT("Conversation[] | Message[]"),
      { name: "send", type: "UseMutationResult<unknown, Error, string>", description: "useMessages only. mutate(text) replies from the conversation's account and refetches." },
    ],
    usage: `const inbox = useInbox();
// Zernio needs the conversation's accountId to read or reply.
const thread = useMessages(inbox.data?.[0] ?? null);

thread.send.mutate("Yes, August is free.");`,
  },
  {
    slug: "use-analytics",
    name: "useAnalytics",
    description: "Totals and a daily series for the tenant's profile.",
    signature: "function useAnalytics(opts?: { days?: number }): UseQueryResult<AnalyticsSummary>",
    endpoints: ["GET /v1/analytics/daily-metrics"],
    returns: [QUERY_RESULT("{ totals: { impressions, engagement, clicks, posts }; daily: { date, impressions, engagement }[] }")],
    usage: `const { data } = useAnalytics({ days: 30 });
data?.totals.impressions; // missing days are filled with zeros`,
  },
  {
    slug: "use-connect",
    name: "useConnect",
    description: "Start Zernio's hosted OAuth flow for a platform.",
    signature: "function useConnect(): UseMutationResult<string, Error, ConnectOptions>",
    endpoints: ["GET /v1/connect/{platform}"],
    returns: [{ name: "mutateAsync", type: "(args) => Promise<string>", description: "Resolves to the authUrl. Redirect the browser to it." }],
    usage: `const connect = useConnect();

const url = await connect.mutateAsync({ platform: "linkedin", brandName: "Hostly", primaryColor: "#c8502a" });
window.location.href = url;`,
  },
];

export const RULES_API: RulesFnDoc[] = [
  {
    name: "validate",
    signature: "validate(post: ComposerPost, platforms: readonly PlatformId[]): ValidationResult",
    description: "Every issue for every platform, plus a per-platform index. valid is false when any issue is an error.",
    usage: `const { valid, issues, byPlatform } = validate({ content: draft, media: [] }, ["twitter", "youtube"]);
// youtube: { severity: "error", code: "title_required", fix: "add-title" }`,
  },
  {
    name: "adapt",
    signature: "adapt(post: ComposerPost, platform: PlatformId): AdaptedPost",
    description: "The per-platform rendering model: final text, thread segments, what shows before \"more\", counts and limits.",
    usage: `const a = adapt(post, "instagram");
a.preview; // { visible: "We just opened summer availability…", truncated: true }
a.count;   // 214, a.limit: 2200`,
  },
  {
    name: "splitThread",
    signature: "splitThread(text: string, max: number, mode: CountMode, opts?: { numbered?: boolean }): string[]",
    description: "Split long text into segments that each fit, preferring paragraphs, then sentences, then words.",
    usage: `splitThread(longText, 280, "twitter");
// ["First paragraph… 1/3", "Second… 2/3", "Last… 3/3"]`,
  },
  {
    name: "toCreatePostBody",
    signature: "toCreatePostBody(post: ComposerPost, targets: Target[], schedule?: Schedule): CreatePostBody",
    description: "Turn composer state into a POST /v1/posts body: customContent per platform, threadItems for X, Threads and Bluesky, titles where each platform expects them.",
    usage: `const body = toCreatePostBody(post, [{ platform: "twitter", accountId: "acc_x" }], { publishNow: true });
await fetch("/api/zernio/v1/posts", { method: "POST", body: JSON.stringify(body) });`,
  },
];

/** Descriptions for the --ze-* tokens. Values are read from theme.css at build time. */
export const TOKEN_DOCS: Record<string, string> = {
  "--ze-bg": "Card and input background.",
  "--ze-surface": "Page background, hover and subtle fills.",
  "--ze-fg": "Primary text.",
  "--ze-muted": "Secondary text, counters, placeholders.",
  "--ze-border": "Hairlines, card borders, dividers.",
  "--ze-primary": "Buttons, selection rings, chart strokes.",
  "--ze-primary-fg": "Text on primary.",
  "--ze-danger": "Errors and over-limit counts.",
  "--ze-warning": "Warnings.",
  "--ze-info": "Informational issues.",
  "--ze-success": "Success states.",
  "--ze-radius": "Corner radius. Inner elements derive from it.",
  "--ze-font": "Font family for every component.",
};

export interface NavItem {
  title: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: "Getting started",
    items: [
      { title: "Introduction", href: "/" },
      { title: "Installation", href: "/installation" },
      { title: "Theming", href: "/theming" },
      { title: "Server handler", href: "/server" },
    ],
  },
  {
    title: "Agents",
    items: [
      { title: "MCP App", href: "/agents/mcp-app" },
      { title: "Generative UI", href: "/agents/generative-ui" },
    ],
  },
  { title: "Components", items: COMPONENTS.map((c) => ({ title: c.name, href: `/components/${c.slug}` })) },
  { title: "Hooks", items: HOOKS.map((h) => ({ title: h.name, href: `/hooks/${h.slug}` })) },
  { title: "Rules engine", items: [{ title: "validate, adapt, splitThread", href: "/rules" }] },
];

/** Live previews that are not components (served at /preview/<slug> next to the component previews). */
export const EXTRA_PREVIEWS = ["catalog-weekly-report"] as const;

export const THEMES = ["default", "hostly", "ferment", "liftly"] as const;
export type ThemeName = (typeof THEMES)[number];
