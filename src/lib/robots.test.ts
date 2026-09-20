import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import robotsRoute from "../app/robots";
import {
  ROBOTS_ALLOW,
  ROBOTS_DISALLOW,
  ROBOTS_USER_AGENT,
  robotsListsSitemap,
  robotsLooksLikePrivateSitemap,
  robotsMetadata,
  robotsRules,
  robotsTxt,
} from "./robots";

describe("robots.txt policy", () => {
  test("allows public / and /login", () => {
    expect([...ROBOTS_ALLOW]).toEqual(["/", "/login"]);
    const body = robotsTxt();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Allow: /login");
    expect(robotsRules().userAgent).toBe(ROBOTS_USER_AGENT);
    expect(robotsRules().userAgent).toBe("*");
  });

  test("disallows workspaces, API, and admin", () => {
    expect([...ROBOTS_DISALLOW]).toEqual([
      "/w/",
      "/api/",
      "/admin",
      "/?area=admin",
    ]);
    const body = robotsTxt();
    expect(body).toContain("Disallow: /w/");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /admin");
    expect(body).toContain("Disallow: /?area=admin");
  });

  test("does not invent a sitemap of private workspaces", () => {
    const body = robotsTxt();
    expect(robotsListsSitemap(body)).toBe(false);
    expect(robotsLooksLikePrivateSitemap(body)).toBe(false);
    expect(body).not.toMatch(/^\s*sitemap\s*:/im);
    expect(body).not.toMatch(/\/w\/[a-z0-9_-]{8,}/i);
    expect(robotsMetadata()).not.toHaveProperty("sitemap");
    expect(robotsMetadata()).not.toHaveProperty("host");
  });

  test("static public/robots.txt matches the generated body", () => {
    const disk = readFileSync(
      join(import.meta.dir, "..", "..", "public", "robots.txt"),
      "utf8",
    );
    expect(disk).toBe(robotsTxt());
  });

  test("App Router robots() uses the same rules and omits sitemap", () => {
    const doc = robotsRoute();
    expect(doc).toEqual(robotsMetadata());
    expect(doc.sitemap).toBeUndefined();
    expect("host" in doc).toBe(false);
    expect(doc.rules).toEqual({
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: ["/w/", "/api/", "/admin", "/?area=admin"],
    });
  });
});
