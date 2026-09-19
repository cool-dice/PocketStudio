import { describe, expect, test } from "bun:test";

import { remainingAdminsAfterDemote } from "./admin-role-lock";
import {
  LAST_ADMIN_DELETE,
  LAST_ADMIN_DEMOTE,
  MAX_ADMIN_USERS,
  ROLE_CHANGE_FAILED,
  SELF_ROLE_CHANGE,
  USERS_EMPTY,
  USERS_EMPTY_FILTER,
  USERS_FORBIDDEN,
  USERS_FORBIDDEN_HINT,
  USERS_LOAD_ERROR,
  USERS_LOAD_ERROR_HINT,
  USERS_RETRY,
  adminUsersEmptyCopy,
  adminUsersListView,
  adminUsersLoadErrorFromHttp,
  roleChangeBlock,
  roleChangeError,
  roleChangedToast,
  toPublicAdminUserListItem,
  usersPageHasMore,
} from "./admin-users-copy";

const FAKE_HASH = "$2b$10$LEAKMEPASSWORDHASH99abcdefghijklmnopqrstuv";

describe("admin users list empty vs error vs loading vs 403", () => {
  test("load error and 403 are not the empty-users message", () => {
    expect(USERS_LOAD_ERROR).not.toBe(USERS_EMPTY);
    expect(USERS_FORBIDDEN).not.toBe(USERS_EMPTY);
    expect(USERS_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(USERS_FORBIDDEN).not.toMatch(/пока нет/i);
    expect(USERS_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(USERS_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(USERS_EMPTY_FILTER).toMatch(/[А-Яа-яЁё]/);
    expect(USERS_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(USERS_FORBIDDEN).toMatch(/администратор/i);
    expect(USERS_FORBIDDEN_HINT).toMatch(/клиент/i);
    expect(USERS_RETRY).toMatch(/повторить/i);
    expect(adminUsersEmptyCopy(false)).toBe(USERS_EMPTY);
    expect(adminUsersEmptyCopy(true)).toBe(USERS_EMPTY_FILTER);
  });

  test("failed load is error, 403 is forbidden, successful [] is empty", () => {
    expect(adminUsersListView(true, null, 0)).toBe("loading");
    expect(adminUsersListView(true, USERS_LOAD_ERROR, 0)).toBe("loading");
    expect(adminUsersListView(false, USERS_LOAD_ERROR, 0)).toBe("error");
    expect(adminUsersListView(false, USERS_LOAD_ERROR, 3)).toBe("error");
    expect(adminUsersListView(false, USERS_FORBIDDEN, 0)).toBe("forbidden");
    expect(adminUsersListView(false, USERS_FORBIDDEN, 4)).toBe("forbidden");
    expect(adminUsersListView(false, null, 0)).toBe("empty");
    expect(adminUsersListView(false, null, 2)).toBe("ready");
  });

  test("hasMore is true only when the fetch overflowed the 500 cap", () => {
    expect(MAX_ADMIN_USERS).toBe(500);
    expect(usersPageHasMore(500, MAX_ADMIN_USERS)).toBe(false);
    expect(usersPageHasMore(501, MAX_ADMIN_USERS)).toBe(true);
    expect(usersPageHasMore(0, MAX_ADMIN_USERS)).toBe(false);
  });

  test("HTTP 403 maps to forbidden copy, not empty and not a generic 500", () => {
    expect(adminUsersLoadErrorFromHttp(403)).toBe(USERS_FORBIDDEN);
    expect(adminUsersLoadErrorFromHttp(403, "nope")).toBe(USERS_FORBIDDEN);
    expect(adminUsersLoadErrorFromHttp(500, USERS_LOAD_ERROR)).toBe(
      USERS_LOAD_ERROR,
    );
    expect(adminUsersLoadErrorFromHttp(500)).toBe(USERS_LOAD_ERROR);
    expect(adminUsersLoadErrorFromHttp(0, "Нет соединения с сервером")).toBe(
      "Нет соединения с сервером",
    );
  });
});

describe("last-admin demotion guard", () => {
  test("sole admin cannot demote themselves or anyone who is that last admin", () => {
    expect(
      roleChangeBlock({
        actorId: "a1",
        targetId: "a1",
        targetRole: "admin",
        nextRole: "client",
        adminCount: 1,
      }),
    ).toBe("last-admin");
    expect(
      roleChangeBlock({
        actorId: "a1",
        targetId: "a2",
        targetRole: "admin",
        nextRole: "client",
        adminCount: 1,
      }),
    ).toBe("last-admin");
    expect(roleChangeError("last-admin")).toBe(LAST_ADMIN_DEMOTE);
    expect(LAST_ADMIN_DEMOTE).toMatch(/последн/i);
    expect(LAST_ADMIN_DELETE).toMatch(/удалить последнего/i);
    expect(LAST_ADMIN_DEMOTE).not.toBe(SELF_ROLE_CHANGE);
    expect(LAST_ADMIN_DELETE).not.toBe(LAST_ADMIN_DEMOTE);
  });

  test("with another admin, self-demote is still blocked; peer demote is allowed", () => {
    expect(
      roleChangeBlock({
        actorId: "a1",
        targetId: "a1",
        targetRole: "admin",
        nextRole: "client",
        adminCount: 2,
      }),
    ).toBe("self");
    expect(
      roleChangeBlock({
        actorId: "a1",
        targetId: "a2",
        targetRole: "admin",
        nextRole: "client",
        adminCount: 2,
      }),
    ).toBeNull();
    expect(
      roleChangeBlock({
        actorId: "a1",
        targetId: "c1",
        targetRole: "client",
        nextRole: "admin",
        adminCount: 1,
      }),
    ).toBeNull();
    expect(roleChangeError("self")).toBe(SELF_ROLE_CHANGE);
  });

  test("remaining admin count after one demote never goes below the last admin", () => {
    expect(remainingAdminsAfterDemote(1)).toBe(0);
    expect(remainingAdminsAfterDemote(2)).toBe(1);
    expect(remainingAdminsAfterDemote(2)).toBeGreaterThanOrEqual(1);
  });

  test("role-change toast copy is Russian and distinct from the failure string", () => {
    expect(roleChangedToast("Анна", "admin")).toMatch(/администратор/);
    expect(roleChangedToast("Анна", "client")).toMatch(/обычный/);
    expect(ROLE_CHANGE_FAILED).not.toBe(roleChangedToast("Анна", "admin"));
  });
});

describe("admin user DTO never echoes password hashes", () => {
  test("public list item drops passwordHash and unknown roles become client", () => {
    const pub = toPublicAdminUserListItem({
      id: "u1",
      email: "a@example.test",
      name: "Анна",
      role: "admin",
      createdAt: new Date("2026-09-19T10:00:00.000Z"),
      lastActivity: null,
      counts: { notes: 2, threads: 1, projects: 0 },
      passwordHash: FAKE_HASH,
    });
    expect("passwordHash" in pub).toBe(false);
    expect(Object.keys(pub).sort()).toEqual(
      [
        "counts",
        "createdAt",
        "email",
        "id",
        "lastActivity",
        "name",
        "role",
      ].sort(),
    );
    const blob = JSON.stringify(pub);
    expect(blob).not.toContain(FAKE_HASH);
    expect(blob).not.toMatch(/passwordHash|bcrypt|\$2[aby]\$/i);
    expect(pub.role).toBe("admin");
    expect(pub.lastActivity).toBeNull();
    expect(
      toPublicAdminUserListItem({
        id: "u2",
        email: "b@example.test",
        name: "Боб",
        role: "hacker",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        passwordHash: FAKE_HASH,
      }).role,
    ).toBe("client");
  });
});
