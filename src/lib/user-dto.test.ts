import { describe, expect, test } from "bun:test";

import { publicUserDto } from "./user-dto";

describe("publicUserDto", () => {
  test("never includes passwordHash and normalizes role", () => {
    const dto = publicUserDto({
      id: "u1",
      email: "a@example.test",
      name: "Анна",
      role: "admin",
      createdAt: new Date("2026-09-19T10:00:00.000Z"),
      onboardingDone: true,
    });
    expect(dto).toEqual({
      id: "u1",
      email: "a@example.test",
      name: "Анна",
      role: "admin",
      createdAt: "2026-09-19T10:00:00.000Z",
      onboardingDone: true,
    });
    expect(JSON.stringify(dto)).not.toMatch(/password/i);
    expect(publicUserDto({
      id: "u2",
      email: "b@example.test",
      name: "Боб",
      role: "hacker",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }).role).toBe("client");
  });
});
