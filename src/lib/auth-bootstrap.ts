/**
 * Public bootstrap flag for first-user-admin copy.
 * Must match POST /api/auth/register: ensureAdminSeed() then
 * role = invite ?? (userCount === 0 ? admin : client).
 * Never returns emails, passwords, or other secrets.
 */

import { db } from "@/lib/db";
import { adminSeedConfigured } from "@/lib/seed";

export function firstUserBecomesAdminFromState(
  userCount: number,
  seedConfigured: boolean,
): boolean {
  if (userCount > 0) return false;
  // Seed runs before register() counts users, so the next public
  // registrant is not admin when ADMIN_EMAIL + ADMIN_PASSWORD are set.
  if (seedConfigured) return false;
  return true;
}

export async function firstUserBecomesAdmin(): Promise<boolean> {
  const userCount = await db.user.count();
  return firstUserBecomesAdminFromState(userCount, adminSeedConfigured());
}
