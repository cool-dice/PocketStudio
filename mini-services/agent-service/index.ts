// agent-service bootstrap.
// Env fallbacks MUST run BEFORE importing anything that reads env
// (server.ts → auth.ts reads AUTH_SECRET at module level; db-client.ts →
// src/lib/db.ts → PrismaClient reads DATABASE_URL at construction time).

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
process.env.AUTH_SECRET ||= "vf-local-dev-secret-9f2c";
process.env.VIBEFLOW_WORKSPACE_ROOT ||= "/home/z/my-project/workspace";

await import("./server.ts");
