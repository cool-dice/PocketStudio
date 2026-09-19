/**
 * Last-admin demotion must serialize: two PATCHes that each see
 * adminCount=2 can otherwise both commit and leave zero admins.
 * SELECT … FOR UPDATE on current admin rows; the second tx waits,
 * then recounts. Isolation stays the Prisma default (not SERIALIZABLE).
 */
import type { Prisma } from "@prisma/client";

export async function lockAndCountAdmins(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE role = 'admin' ORDER BY id FOR UPDATE
  `;
  return rows.length;
}

/** After demoting one locked admin, this many must remain. */
export function remainingAdminsAfterDemote(lockedCount: number): number {
  return lockedCount - 1;
}
