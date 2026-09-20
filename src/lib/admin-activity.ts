/**
 * Last real content activity for an admin user row.
 * Account updatedAt is ignored — role changes would otherwise look like
 * the user just did work, and a brand-new account would never show
 * «ещё ничего не делал».
 */

export function lastActivityOf(
  dates: Array<Date | string | null | undefined>,
): Date | null {
  let max = 0;
  for (const d of dates) {
    if (d == null) continue;
    const t = d instanceof Date ? d.getTime() : Date.parse(String(d));
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max > 0 ? new Date(max) : null;
}
