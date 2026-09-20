import { describe, expect, test } from "bun:test";

import { DEFAULT_POSTGRES_URL, resolveDatabaseUrl } from "./database-url";

describe("resolveDatabaseUrl", () => {
  test("keeps a postgres URL", () => {
    expect(resolveDatabaseUrl("postgresql://u:p@127.0.0.1:5432/pocketstudio")).toBe(
      "postgresql://u:p@127.0.0.1:5432/pocketstudio",
    );
    expect(resolveDatabaseUrl("postgres://u:p@127.0.0.1/db")).toBe(
      "postgres://u:p@127.0.0.1/db",
    );
  });

  test("rejects leftover SQLite so Next does not 500 on Project.archived", () => {
    expect(resolveDatabaseUrl("file:/workspace/db/custom.db")).toBe(
      DEFAULT_POSTGRES_URL,
    );
    expect(resolveDatabaseUrl("file:./db/custom.db")).toBe(DEFAULT_POSTGRES_URL);
    expect(resolveDatabaseUrl(undefined)).toBe(DEFAULT_POSTGRES_URL);
    expect(resolveDatabaseUrl("")).toBe(DEFAULT_POSTGRES_URL);
  });
});
