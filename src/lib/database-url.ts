/**
 * PocketStudio persists to PostgreSQL + pgvector.
 * Leftover SQLite URLs (file:./db/custom.db, z-ai preview) are not a
 * supported runtime — they 500 routes whose Prisma client is postgres.
 */

export const DEFAULT_POSTGRES_URL =
  "postgresql://pocketstudio:pocketstudio@127.0.0.1:5432/pocketstudio";

export function resolveDatabaseUrl(
  url: string | undefined = process.env.DATABASE_URL,
): string {
  if ((url ?? "").startsWith("postgres")) return url as string;
  return DEFAULT_POSTGRES_URL;
}

/** Apply the resolved URL on process.env before constructing PrismaClient. */
export function applyDatabaseUrl(): string {
  const resolved = resolveDatabaseUrl();
  if (process.env.DATABASE_URL !== resolved) {
    console.warn(
      "[db] Ignoring non-PostgreSQL DATABASE_URL. SQLite is not a supported store.",
    );
    process.env.DATABASE_URL = resolved;
  }
  return resolved;
}
