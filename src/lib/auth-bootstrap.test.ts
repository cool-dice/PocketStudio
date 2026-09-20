import { describe, expect, test } from "bun:test";

import { firstUserBecomesAdminFromState } from "./auth-bootstrap";

describe("firstUserBecomesAdminFromState", () => {
  test("empty DB → true", () => {
    expect(firstUserBecomesAdminFromState(0, false)).toBe(true);
  });

  test("after a user exists → false", () => {
    expect(firstUserBecomesAdminFromState(1, false)).toBe(false);
    expect(firstUserBecomesAdminFromState(3, false)).toBe(false);
  });

  test("ADMIN_EMAIL seed on empty DB → false (matches register())", () => {
    expect(firstUserBecomesAdminFromState(0, true)).toBe(false);
    expect(firstUserBecomesAdminFromState(1, true)).toBe(false);
  });
});
