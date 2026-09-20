/**
 * Crawl policy for public surfaces only.
 * Workspaces, REST, and admin are private — never list them in a sitemap.
 * HTML for `/w/*` also sends meta robots noindex so crawlers that ignore
 * robots.txt still skip private shells. The guest landing must stay indexable.
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

/** Next.js `Metadata.robots` — private app HTML is noindex. */
export const APP_NOINDEX_ROBOTS = { index: false } as const;

export type AppNoindexRobots = typeof APP_NOINDEX_ROBOTS;

function pathnameOnly(urlPath: string): string {
  const noHash = urlPath.split("#")[0] ?? urlPath;
  const path = (noHash.split("?")[0] || "/").trim();
  if (!path || path === "") return "/";
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

/** Workspace shells: `/w` and `/w/[id]` (query ignored). */
export function isWorkspacePathname(pathname: string): boolean {
  const path = pathnameOnly(pathname);
  return path === "/w" || path.startsWith("/w/");
}

export function isLoginPathname(pathname: string): boolean {
  return pathnameOnly(pathname) === "/login";
}

export function isPublicLandingPathname(pathname: string): boolean {
  return pathnameOnly(pathname) === "/";
}

/**
 * Meta robots for a document URL.
 * `/w/*` is always noindex.
 * Logged-in `/` is the authenticated shell — noindex if that layout opts in.
 * Guest `/` and `/login` stay indexable (do not set robots on the root layout).
 */
export function pageRobots(input: {
  pathname: string;
  loggedIn?: boolean;
}): AppNoindexRobots | undefined {
  if (isWorkspacePathname(input.pathname)) return APP_NOINDEX_ROBOTS;
  if (input.loggedIn && isPublicLandingPathname(input.pathname)) {
    return APP_NOINDEX_ROBOTS;
  }
  return undefined;
}

/** Spread onto App Router `metadata` for `/w/*`. */
export function appRouteMetadata(): { robots: AppNoindexRobots } {
  return { robots: APP_NOINDEX_ROBOTS };
}

export function metadataAllowsIndexing(metadata: {
  robots?: { index?: boolean } | string | null;
}): boolean {
  const robots = metadata.robots;
  if (robots == null) return true;
  if (typeof robots === "string") return !/\bnoindex\b/i.test(robots);
  return robots.index !== false;
}
