import { describe, expect, test } from "bun:test";

import {
  AUDIT_EMPTY,
  AUDIT_EMPTY_HINT,
  AUDIT_FORBIDDEN,
  AUDIT_FORBIDDEN_HINT,
  AUDIT_HINT,
  AUDIT_LIMIT_DEFAULT,
  AUDIT_LIMIT_INVALID,
  AUDIT_LIMIT_MAX,
  AUDIT_LOAD_ERROR,
  AUDIT_LOAD_ERROR_HINT,
  AUDIT_LOAD_MORE,
  AUDIT_OFFSET_INVALID,
  AUDIT_RETRY,
  AUDIT_TITLE,
  auditListView,
  auditLoadErrorFromHttp,
  auditPageHasMore,
  isSecretAuditKey,
  parseAuditPage,
  redactSecretText,
  toPublicAuditEntry,
} from "./audit-copy";

const FAKE_KEY = "sk-test-LEAKMEAUDITKEY99";
const FAKE_ANT = "sk-ant-LEAKMEANTKEY1234";

describe("audit list empty vs error vs loading vs 403", () => {
  test("load error and 403 are not the empty-journal message", () => {
    expect(AUDIT_LOAD_ERROR).not.toBe(AUDIT_EMPTY);
    expect(AUDIT_FORBIDDEN).not.toBe(AUDIT_EMPTY);
    expect(AUDIT_LOAD_ERROR).not.toMatch(/пока пуст/i);
    expect(AUDIT_FORBIDDEN).not.toMatch(/пока пуст/i);
    expect(AUDIT_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(AUDIT_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(AUDIT_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(AUDIT_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(AUDIT_FORBIDDEN).toMatch(/администратор/i);
    expect(AUDIT_FORBIDDEN_HINT).toMatch(/клиент/i);
    expect(AUDIT_RETRY).toMatch(/повторить/i);
    expect(AUDIT_LOAD_MORE).toMatch(/ещё/i);
    expect(AUDIT_TITLE).toMatch(/журнал/i);
    expect(AUDIT_HINT).toMatch(/[А-Яа-яЁё]/);
  });

  test("failed load is error, 403 is forbidden, successful [] is empty", () => {
    expect(auditListView(true, null, 0)).toBe("loading");
    expect(auditListView(true, AUDIT_LOAD_ERROR, 0)).toBe("loading");
    expect(auditListView(false, AUDIT_LOAD_ERROR, 0)).toBe("error");
    expect(auditListView(false, AUDIT_LOAD_ERROR, 3)).toBe("error");
    expect(auditListView(false, AUDIT_FORBIDDEN, 0)).toBe("forbidden");
    expect(auditListView(false, AUDIT_FORBIDDEN, 4)).toBe("forbidden");
    expect(auditListView(false, null, 0)).toBe("empty");
    expect(auditListView(false, null, 2)).toBe("ready");
  });

  test("HTTP 403 maps to forbidden copy, not empty and not a generic 500", () => {
    expect(auditLoadErrorFromHttp(403)).toBe(AUDIT_FORBIDDEN);
    expect(auditLoadErrorFromHttp(403, "nope")).toBe(AUDIT_FORBIDDEN);
    expect(auditLoadErrorFromHttp(500, AUDIT_LOAD_ERROR)).toBe(AUDIT_LOAD_ERROR);
    expect(auditLoadErrorFromHttp(500)).toBe(AUDIT_LOAD_ERROR);
    expect(auditLoadErrorFromHttp(0, "Нет соединения с сервером")).toBe(
      "Нет соединения с сервером",
    );
  });
});

describe("audit pagination params", () => {
  test("defaults and hasMore from limit+1 fetch", () => {
    expect(parseAuditPage(null, null)).toEqual({
      ok: true,
      limit: AUDIT_LIMIT_DEFAULT,
      offset: 0,
    });
    expect(parseAuditPage("10", "20")).toEqual({
      ok: true,
      limit: 10,
      offset: 20,
    });
    expect(auditPageHasMore(31, 30)).toBe(true);
    expect(auditPageHasMore(30, 30)).toBe(false);
    expect(auditPageHasMore(0, 30)).toBe(false);
  });

  test("invalid limit/offset stay errors, not a silent first page", () => {
    expect(parseAuditPage("0", null)).toEqual({
      ok: false,
      error: AUDIT_LIMIT_INVALID,
    });
    expect(parseAuditPage(String(AUDIT_LIMIT_MAX + 1), null)).toEqual({
      ok: false,
      error: AUDIT_LIMIT_INVALID,
    });
    expect(parseAuditPage("1.5", null).ok).toBe(false);
    expect(parseAuditPage("10", "-1")).toEqual({
      ok: false,
      error: AUDIT_OFFSET_INVALID,
    });
  });
});

describe("audit rows never echo secrets", () => {
  test("secret key names are recognized; sk-/Bearer values redact", () => {
    expect(isSecretAuditKey("apiKey")).toBe(true);
    expect(isSecretAuditKey("api_key")).toBe(true);
    expect(isSecretAuditKey("password")).toBe(true);
    expect(isSecretAuditKey("action")).toBe(false);
    expect(redactSecretText(`key=${FAKE_KEY}`)).not.toContain(FAKE_KEY);
    expect(redactSecretText(`Authorization: Bearer abcdefghijkl`)).toContain(
      "[redacted]",
    );
    expect(redactSecretText("admin.ai.provider.create")).toBe(
      "admin.ai.provider.create",
    );
  });

  test("public DTO drops meta/apiKey and redacts a key stuffed into entityId", () => {
    const pub = toPublicAuditEntry({
      id: "row-1",
      action: "admin.ai.provider.create",
      entity: "aiProvider",
      entityId: FAKE_ANT,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      meta: JSON.stringify({ apiKey: FAKE_KEY, token: "Bearer leakedtoken99" }),
      user: { name: "Админ", email: "admin@example.test" },
    });
    expect("meta" in pub).toBe(false);
    expect(Object.keys(pub).sort()).toEqual(
      ["action", "createdAt", "entity", "entityId", "id", "user"].sort(),
    );
    const blob = JSON.stringify(pub);
    expect(blob).not.toContain(FAKE_KEY);
    expect(blob).not.toContain(FAKE_ANT);
    expect(blob).not.toContain("apiKey");
    expect(blob).not.toMatch(/"meta"/);
    expect(pub.entityId).toBe("[redacted]");
    expect(pub.action).toBe("admin.ai.provider.create");
    expect(pub.user?.email).toBe("admin@example.test");
  });
});
