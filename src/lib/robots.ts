/**
 * Crawl policy for public surfaces only.
 * Workspaces, REST, and admin are private — never list them in a sitemap.
 */

export const ROBOTS_USER_AGENT = "*";

/** Landing (`/`, guest) and login/register. */
export const ROBOTS_ALLOW = ["/", "/login"] as const;

/**
 * Private prefixes. `/w/` is workspace shells; `/api/` covers `/api/admin/`;
 * `/admin` and `/?area=admin` are the admin UI (query + conventional path).
 */
export const ROBOTS_DISALLOW = [
  "/w/",
  "/api/",
  "/admin",
  "/?area=admin",
] as const;

export type RobotsRules = {
  userAgent: string;
  allow: readonly string[];
  disallow: readonly string[];
};

export function robotsRules(): RobotsRules {
  return {
    userAgent: ROBOTS_USER_AGENT,
    allow: ROBOTS_ALLOW,
    disallow: ROBOTS_DISALLOW,
  };
}

/** Next.js `MetadataRoute.Robots` payload — no `sitemap` / `host`. */
export function robotsMetadata(): {
  rules: { userAgent: string; allow: string[]; disallow: string[] };
} {
  const rules = robotsRules();
  return {
    rules: {
      userAgent: rules.userAgent,
      allow: [...rules.allow],
      disallow: [...rules.disallow],
    },
  };
}

export function robotsTxt(): string {
  const { userAgent, allow, disallow } = robotsRules();
  const lines = [`User-agent: ${userAgent}`];
  for (const path of allow) lines.push(`Allow: ${path}`);
  for (const path of disallow) lines.push(`Disallow: ${path}`);
  return `${lines.join("\n")}\n`;
}

const SITEMAP_LINE = /^\s*sitemap\s*:/im;
const WORKSPACE_PATH = /\/w\/[a-z0-9_-]{8,}/i;

export function robotsListsSitemap(body: string): boolean {
  return SITEMAP_LINE.test(body);
}

/** True if the file invents a sitemap or enumerates private workspace URLs. */
export function robotsLooksLikePrivateSitemap(body: string): boolean {
  return robotsListsSitemap(body) || WORKSPACE_PATH.test(body);
}
