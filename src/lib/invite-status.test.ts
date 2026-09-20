import { describe, expect, test } from "bun:test";

import {
  inviteLifecycle,
  inviteListLabel,
  inviteRegisterCopy,
  inviteRoleLabel,
  sanitizeInviteRole,
} from "./invite-status";

describe("inviteLifecycle", () => {
  const now = Date.parse("2026-09-19T12:00:00Z");

  test("missing row is invalid", () => {
    expect(inviteLifecycle(null, now)).toBe("invalid");
    expect(inviteLifecycle(undefined, now)).toBe("invalid");
  });

  test("used beats expiry", () => {
    expect(
      inviteLifecycle(
        {
          usedAt: "2026-09-01T00:00:00Z",
          expiresAt: "2026-09-01T00:00:00Z",
        },
        now,
      ),
    ).toBe("used");
  });

  test("past expiresAt is expired", () => {
    expect(
      inviteLifecycle({ usedAt: null, expiresAt: "2026-09-18T00:00:00Z" }, now),
    ).toBe("expired");
  });

  test("future expiry or none is ok", () => {
    expect(
      inviteLifecycle({ usedAt: null, expiresAt: "2026-10-01T00:00:00Z" }, now),
    ).toBe("ok");
    expect(inviteLifecycle({ usedAt: null, expiresAt: null }, now)).toBe("ok");
  });
});

describe("invite copy", () => {
  test("list labels distinguish used and expired", () => {
    expect(inviteListLabel("ok")).toBe("ожидает");
    expect(inviteListLabel("used")).toBe("использован");
    expect(inviteListLabel("expired")).toBe("истёк");
  });

  test("register copy never claims success for dead tokens", () => {
    expect(inviteRegisterCopy("used")).toMatch(/использован/i);
    expect(inviteRegisterCopy("expired")).toMatch(/истёк/i);
    expect(inviteRegisterCopy("invalid")).toMatch(/недействителен/i);
    expect(inviteRegisterCopy("used")).not.toMatch(/успеш/i);
    expect(inviteRegisterCopy("expired")).not.toMatch(/успеш/i);
  });

  test("role labels stay client|admin", () => {
    expect(inviteRoleLabel("admin")).toBe("админ");
    expect(inviteRoleLabel("client")).toBe("клиент");
    expect(sanitizeInviteRole("admin")).toBe("admin");
    expect(sanitizeInviteRole("superuser")).toBe("client");
  });
});
