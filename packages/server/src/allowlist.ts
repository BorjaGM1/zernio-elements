/**
 * Any accountId in the query string is always checked against the tenant's accounts
 * (inbox messages require one; lists accept one as a filter).
 *
 * Which Zernio endpoints the browser may reach through the handler.
 * Everything else is rejected with 403. Paths verified against @zernio/node's generated SDK.
 * Full endpoint list: docs/zernio-endpoints.txt
 */
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Rule {
  method: Method;
  pattern: RegExp;
  /** Force ?profileId=<tenant> on this call (list endpoints). */
  scopeQuery?: boolean;
  /** Check that every accountId in the JSON body (platforms[].accountId and accountId) belongs to the tenant's profile. */
  checkBodyAccounts?: boolean;
  /** /v1/posts/{id}...: the post must belong to the tenant's profile. */
  checkPostOwner?: boolean;
  /** Force body.profileId to the tenant's profile (create endpoints that take it in the body). */
  scopeBody?: boolean;
  /** Remove these body keys before forwarding (fields that could target another profile). */
  dropBodyKeys?: string[];
}

const ID = "[A-Za-z0-9_-]+";

export const DEFAULT_RULES: Rule[] = [
  // Accounts & connect
  { method: "GET", pattern: /^\/v1\/accounts$/, scopeQuery: true },
  { method: "GET", pattern: /^\/v1\/accounts\/health$/, scopeQuery: true },
  { method: "GET", pattern: new RegExp(`^/v1/connect/${ID}$`), scopeQuery: true },
  // Telegram connects with an access code instead of OAuth: poll this until status is "connected".
  { method: "PATCH", pattern: /^\/v1\/connect\/telegram$/ },
  // ...or connect a channel directly by @username once the bot is an admin there.
  { method: "POST", pattern: /^\/v1\/connect\/telegram$/, scopeBody: true },

  // Posts
  { method: "GET", pattern: /^\/v1\/posts$/, scopeQuery: true },
  { method: "POST", pattern: /^\/v1\/posts$/, checkBodyAccounts: true, dropBodyKeys: ["profileId", "queuedFromProfile"] },
  { method: "GET", pattern: new RegExp(`^/v1/posts/${ID}$`), checkPostOwner: true },
  { method: "PUT", pattern: new RegExp(`^/v1/posts/${ID}$`), checkPostOwner: true, checkBodyAccounts: true, dropBodyKeys: ["profileId", "queuedFromProfile"] },
  { method: "DELETE", pattern: new RegExp(`^/v1/posts/${ID}$`), checkPostOwner: true },
  { method: "POST", pattern: new RegExp(`^/v1/posts/${ID}/retry$`), checkPostOwner: true },

  // Media + validation
  { method: "POST", pattern: /^\/v1\/media\/presign$/ },
  { method: "POST", pattern: /^\/v1\/tools\/validate\/(post|post-length|media)$/ },

  // Queue
  { method: "GET", pattern: /^\/v1\/queue\/(next-slot|slots|preview)$/, scopeQuery: true },

  // Inbox
  { method: "GET", pattern: /^\/v1\/inbox\/conversations$/, scopeQuery: true },
  { method: "GET", pattern: new RegExp(`^/v1/inbox/conversations/${ID}/messages$`) },
  { method: "POST", pattern: new RegExp(`^/v1/inbox/conversations/${ID}/messages$`), checkBodyAccounts: true },
  { method: "GET", pattern: /^\/v1\/inbox\/comments$/, scopeQuery: true },

  // Analytics
  { method: "GET", pattern: /^\/v1\/analytics$/, scopeQuery: true },
  { method: "GET", pattern: /^\/v1\/analytics\/(dashboard|daily-metrics|best-time|post-timeline)$/, scopeQuery: true },
];

export function matchRule(rules: Rule[], method: string, path: string): Rule | undefined {
  return rules.find((r) => r.method === method && r.pattern.test(path));
}
