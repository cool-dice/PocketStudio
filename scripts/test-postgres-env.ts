/**
 * bun test --preload: product tests require PostgreSQL.
 * Leftover SQLITE DATABASE_URL from older checkouts is ignored.
 */
const DEFAULT =
  "postgresql://pocketstudio:pocketstudio@127.0.0.1:5432/pocketstudio";

if (!(process.env.DATABASE_URL ?? "").startsWith("postgres")) {
  process.env.DATABASE_URL = DEFAULT;
}
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = "vf-local-dev-secret-9f2c";
}
