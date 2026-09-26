/**
 * First-run tour gating. A late GET /api/me/onboarding must not cover
 * welcome chips or CreateWorkspaceDialog. Skip/complete is per-user.
 */

export const ONBOARDING_STORAGE_PREFIX = "pocketstudio-onboarding-done:";

export type OnboardingKv = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function onboardingStorageKey(userId: string): string {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

export function readOnboardingDone(
  userId: string,
  store?: OnboardingKv | null,
): boolean {
  if (!userId) return false;
  try {
    const kv = store ?? (typeof window === "undefined" ? null : window.localStorage);
    if (!kv) return false;
    return kv.getItem(onboardingStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeOnboardingDone(
  userId: string,
  store?: OnboardingKv | null,
): void {
  if (!userId) return;
  try {
    const kv = store ?? (typeof window === "undefined" ? null : window.localStorage);
    kv?.setItem(onboardingStorageKey(userId), "1");
  } catch {
    /* private mode */
  }
}

export function onboardingBlocksTour(opts: {
  createWorkspaceOpen: boolean;
  createProjectOpen: boolean;
  captureOpen?: boolean;
  mainArea: string;
}): boolean {
  if (opts.createWorkspaceOpen || opts.createProjectOpen || opts.captureOpen) {
    return true;
  }
  return opts.mainArea === "workspace" || opts.mainArea === "project";
}

export function shouldOpenOnboarding(opts: {
  userId: string | null | undefined;
  userDone: boolean;
  localDone: boolean;
  finishing: boolean;
  blocksTour: boolean;
}): boolean {
  if (!opts.userId) return false;
  if (opts.userDone || opts.localDone || opts.finishing || opts.blocksTour) {
    return false;
  }
  return true;
}
