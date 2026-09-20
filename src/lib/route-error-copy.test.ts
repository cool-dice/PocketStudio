import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NOT_FOUND_BODY,
  NOT_FOUND_META_TITLE,
  NOT_FOUND_TITLE,
  ROUTE_ERROR_BODY,
  ROUTE_ERROR_RETRY,
  ROUTE_ERROR_TITLE,
  ROUTE_HOME_HREF,
  ROUTE_HOME_LABEL,
  ROUTE_LOGIN_HREF,
  ROUTE_LOGIN_LABEL,
  routeErrorLooksLikeLeak,
  routeErrorUserBlob,
  routeErrorViewModel,
} from "./route-error-copy";

const DIGEST = "8f3a1c9e0b2d4a76";
const LEAKY = Object.assign(
  new Error(
    [
      "Can't reach DATABASE_URL=postgresql://pocketstudio:secret@127.0.0.1:5432/db",
      "AUTH_SECRET=super-secret-value",
      "    at boom (/workspace/src/app/page.tsx:12:5)",
    ].join("\n"),
  ),
  { digest: DIGEST },
);

const CYRILLIC = /[А-Яа-яЁё]/;
const ENGLISH_NEXT =
  /Something went wrong|This page could not be found|Internal Server Error/i;

describe("route error / not-found copy", () => {
  test("not-found is Russian and links home + login", () => {
    const model = routeErrorViewModel("not-found", LEAKY);
    expect(model.kind).toBe("not-found");
    expect(model.title).toBe(NOT_FOUND_TITLE);
    expect(model.body).toBe(NOT_FOUND_BODY);
    expect(model.retryLabel).toBeNull();
    expect(model.homeHref).toBe(ROUTE_HOME_HREF);
    expect(model.loginHref).toBe(ROUTE_LOGIN_HREF);
    expect(model.homeLabel).toBe(ROUTE_HOME_LABEL);
    expect(model.loginLabel).toBe(ROUTE_LOGIN_LABEL);
    expect(model.title).toMatch(CYRILLIC);
    expect(model.body).toMatch(CYRILLIC);
    expect(NOT_FOUND_META_TITLE).toMatch(CYRILLIC);
    expect(model.title).not.toMatch(ENGLISH_NEXT);
  });

  test("error boundary is Russian with retry, home, and login", () => {
    const model = routeErrorViewModel("error", LEAKY);
    expect(model.kind).toBe("error");
    expect(model.title).toBe(ROUTE_ERROR_TITLE);
    expect(model.body).toBe(ROUTE_ERROR_BODY);
    expect(model.retryLabel).toBe(ROUTE_ERROR_RETRY);
    expect(model.homeHref).toBe("/");
    expect(model.loginHref).toBe("/login");
    expect(model.title).toMatch(CYRILLIC);
    expect(model.body).toMatch(CYRILLIC);
    expect(model.retryLabel).toMatch(CYRILLIC);
    expect(model.title).not.toMatch(ENGLISH_NEXT);
  });

  test("never echoes digest, stack, secrets, or Next English defaults", () => {
    for (const kind of ["not-found", "error"] as const) {
      const model = routeErrorViewModel(kind, LEAKY);
      const blob = JSON.stringify(model) + "\n" + routeErrorUserBlob(kind, LEAKY);
      expect(routeErrorLooksLikeLeak(model)).toBe(false);
      expect(routeErrorLooksLikeLeak(blob)).toBe(false);
      expect(blob).not.toContain(DIGEST);
      expect(blob).not.toContain(LEAKY.message);
      expect(blob).not.toMatch(/DATABASE_URL/);
      expect(blob).not.toMatch(/AUTH_SECRET/);
      expect(blob).not.toMatch(/digest/i);
      expect(blob).not.toMatch(ENGLISH_NEXT);
    }
    expect(routeErrorLooksLikeLeak(LEAKY.message)).toBe(true);
    expect(routeErrorLooksLikeLeak({ digest: DIGEST })).toBe(true);
  });
});

describe("route error page sources", () => {
  test("pages do not render error.message, stack, or digest", () => {
    const root = join(import.meta.dir, "..", "app");
    const files = ["error.tsx", "not-found.tsx", "global-error.tsx"];
    for (const name of files) {
      const src = readFileSync(join(root, name), "utf8");
      expect(src).not.toMatch(/error\.message/);
      expect(src).not.toMatch(/error\.stack/);
      expect(src).not.toMatch(/error\.digest/);
      expect(src).toMatch(/routeErrorViewModel/);
    }
  });
});
