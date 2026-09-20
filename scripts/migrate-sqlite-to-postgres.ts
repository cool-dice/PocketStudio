/**
 * One-shot SQLite → Postgres copy for a local PocketStudio db.
 *
 * Does NOT dump secrets into git. Reads SQLITE_PATH (default db/custom.db)
 * and writes to DATABASE_URL (must be postgresql://).
 *
 * Fresh `prisma db push` on empty Postgres is the supported path for this
 * stage. Use this script only if you have a local custom.db you want to keep.
 *
 *   DATABASE_URL=postgresql://… bun scripts/migrate-sqlite-to-postgres.ts
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const SQLITE_PATH =
  process.env.SQLITE_PATH ?? path.join(process.cwd(), "db/custom.db");

const TABLE_ORDER = [
  "User",
  "Category",
  "Tag",
  "Note",
  "NoteTag",
  "Project",
  "NoteLink",
  "Document",
  "DocumentSection",
  "DocumentSectionRevision",
  "Entity",
  "EntityLink",
  "Artifact",
  "DawProject",
  "McpServer",
  "Finding",
  "Thread",
  "Task",
  "Message",
  "AgentRun",
  "AgentEvent",
  "Notification",
  "SystemSetting",
  "AiProvider",
  "AiModel",
  "ToolModelDefault",
  "UserToolModel",
  "AuditLog",
  "Skill",
  "Offer",
  "Payout",
  "DesignDoc",
  "VideoProject",
  "Invite",
];

function toJs(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  return value;
}

async function main() {
  if (!existsSync(SQLITE_PATH)) {
    console.log(`Нет ${SQLITE_PATH} — нечего переносить. Свежий prisma db push ок.`);
    return;
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgres")) {
    console.error("DATABASE_URL должен указывать на PostgreSQL.");
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new PrismaClient();

  try {
    for (const table of TABLE_ORDER) {
      let rows: Record<string, unknown>[] = [];
      try {
        rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
      } catch {
        console.log(`skip ${table} (нет в sqlite)`);
        continue;
      }
      if (rows.length === 0) {
        console.log(`${table}: 0`);
        continue;
      }
      const quoted = `"${table}"`;
      let copied = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        const values = cols.map((c) => toJs(row[c]));
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const colSql = cols.map((c) => `"${c}"`).join(", ");
        try {
          await pg.$executeRawUnsafe(
            `INSERT INTO ${quoted} (${colSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            ...values,
          );
          copied += 1;
        } catch (err) {
          console.warn(
            `${table} row skipped:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      console.log(`${table}: ${copied}/${rows.length}`);
    }
    console.log("Готово. Прогоните bun scripts/ensure-pgvector.ts и POST /api/rag/reindex.");
  } finally {
    sqlite.close();
    await pg.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
