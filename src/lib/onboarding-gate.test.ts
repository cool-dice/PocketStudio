import { describe, expect, test } from "bun:test";

import {
  onboardingBlocksTour,
  onboardingStorageKey,
  readOnboardingDone,
  shouldOpenOnboarding,
  writeOnboardingDone,
  type OnboardingKv,
} from "./onboarding-gate";

function memoryStore(init: Record<string, string> = {}): OnboardingKv {
  const map = new Map(Object.entries(init));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("shouldOpenOnboarding", () => {
  const base = {
    userId: "u1",
    userDone: false,
    localDone: false,
    finishing: false,
    blocksTour: false,
  };

  test("brand-new user on empty chat sees the tour once", () => {
    expect(shouldOpenOnboarding(base)).toBe(true);
  });

  test("skip/complete never reopens (server, local, or in-flight finish)", () => {
    expect(shouldOpenOnboarding({ ...base, userDone: true })).toBe(false);
    expect(shouldOpenOnboarding({ ...base, localDone: true })).toBe(false);
    expect(shouldOpenOnboarding({ ...base, finishing: true })).toBe(false);
  });

  test("late GET cannot cover create dialog, capture, or a workspace shell", () => {
    expect(shouldOpenOnboarding({ ...base, blocksTour: true })).toBe(false);
    expect(
      onboardingBlocksTour({
        createWorkspaceOpen: true,
        createProjectOpen: false,
        mainArea: "chat",
      }),
    ).toBe(true);
    expect(
      onboardingBlocksTour({
        createWorkspaceOpen: false,
        createProjectOpen: false,
        captureOpen: true,
        mainArea: "chat",
      }),
    ).toBe(true);
    expect(
      onboardingBlocksTour({
        createWorkspaceOpen: false,
        createProjectOpen: false,
        mainArea: "workspace",
      }),
    ).toBe(true);
    expect(
      onboardingBlocksTour({
        createWorkspaceOpen: false,
        createProjectOpen: false,
        mainArea: "chat",
      }),
    ).toBe(false);
  });
});

describe("per-user local skip", () => {
  test("done for one user does not hide the tour for another", () => {
    const store = memoryStore();
    writeOnboardingDone("alice", store);
    expect(readOnboardingDone("alice", store)).toBe(true);
    expect(readOnboardingDone("bob", store)).toBe(false);
    expect(onboardingStorageKey("alice")).toContain("alice");
  });
});
