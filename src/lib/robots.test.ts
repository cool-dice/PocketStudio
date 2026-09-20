import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { metadata as workspaceLayoutMetadata } from "../app/w/layout";
import robotsRoute from "../app/robots";
import {
  APP_NOINDEX_ROBOTS,
  ROBOTS_ALLOW,
  ROBOTS_DISALLOW,
  ROBOTS_USER_AGENT,
  appRouteMetadata,
  isLoginPathname,
  isPublicLandingPathname,
  isWorkspacePathname,
  metadataAllowsIndexing,
  pageRobots,
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

describe("page meta robots (noindex)", () => {
  test("workspace paths are always noindex", () => {
    expect(isWorkspacePathname("/w")).toBe(true);
    expect(isWorkspacePathname("/w/")).toBe(true);
    expect(isWorkspacePathname("/w/abc12345")).toBe(true);
    expect(isWorkspacePathname("/w/abc12345?tab=chat")).toBe(true);
    expect(isWorkspacePathname("/welcome")).toBe(false);
    expect(isWorkspacePathname("/wiki")).toBe(false);
    expect(pageRobots({ pathname: "/w/abc12345" })).toEqual(APP_NOINDEX_ROBOTS);
    expect(pageRobots({ pathname: "/w/abc12345", loggedIn: false })).toEqual(
      APP_NOINDEX_ROBOTS,
    );
    expect(pageRobots({ pathname: "/w/abc12345", loggedIn: true })).toEqual(
      APP_NOINDEX_ROBOTS,
    );
    expect(appRouteMetadata()).toEqual({ robots: { index: false } });
    expect(appRouteMetadata().robots.index).toBe(false);
  });

  test("guest landing and login stay indexable", () => {
    expect(isPublicLandingPathname("/")).toBe(true);
    expect(isPublicLandingPathname("/?area=admin")).toBe(true);
    expect(isLoginPathname("/login")).toBe(true);
    expect(isLoginPathname("/login?tab=register")).toBe(true);
    expect(pageRobots({ pathname: "/" })).toBeUndefined();
    expect(pageRobots({ pathname: "/", loggedIn: false })).toBeUndefined();
    expect(pageRobots({ pathname: "/login" })).toBeUndefined();
    expect(pageRobots({ pathname: "/login", loggedIn: true })).toBeUndefined();
    expect(metadataAllowsIndexing({})).toBe(true);
    expect(metadataAllowsIndexing({ robots: { index: false } })).toBe(false);
  });

  test("logged-in `/` is the app shell (noindex) without touching guest landing", () => {
    expect(pageRobots({ pathname: "/", loggedIn: true })).toEqual(
      APP_NOINDEX_ROBOTS,
    );
    expect(pageRobots({ pathname: "/", loggedIn: false })).toBeUndefined();
  });

  test("App Router /w layout exports noindex; root layout does not", () => {
    expect(workspaceLayoutMetadata).toEqual(appRouteMetadata());
    expect(workspaceLayoutMetadata.robots).toEqual({ index: false });
    expect(metadataAllowsIndexing(workspaceLayoutMetadata)).toBe(false);
    const rootLayout = readFileSync(
      join(import.meta.dir, "..", "app", "layout.tsx"),
      "utf8",
    );
    expect(rootLayout).not.toMatch(/index:\s*false/);
    expect(rootLayout).not.toMatch(/noindex/i);
    expect(rootLayout).toMatch(/do not set robots\.index false/i);
    const workspaceLayoutSrc = readFileSync(
      join(import.meta.dir, "..", "app", "w", "layout.tsx"),
      "utf8",
    );
    expect(workspaceLayoutSrc).toMatch(/appRouteMetadata/);
    expect(workspaceLayoutSrc).not.toMatch(/["']use client["']/);
  });
});
