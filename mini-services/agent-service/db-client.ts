// Agent-service Prisma client.
//
// Own instance (NOT the shared src/lib/db.ts one) because the main app's
// client enables `log: ['query']` for dev visibility — in this long-running
// service that would spam /tmp/agent-service.log with every analyzer poll.
// Same DATABASE_URL as the Next app (PostgreSQL + pgvector).

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  vfAgentPrisma?: PrismaClient;
};

export const db =
  globalForPrisma.vfAgentPrisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.vfAgentPrisma = db;
