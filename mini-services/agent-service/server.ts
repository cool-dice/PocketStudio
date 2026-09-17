// agent-service — socket.io transport + Stage-0 agent turn orchestration.
//
// Contract (worklog Task 1):
//   Client→server: "thread:join" {threadId}; "thread:leave" {threadId};
//                  "message:send" {threadId, content}
//   Server→client: "message:user" {message}; "agent:thinking" {threadId};
//                  "message:start" {threadId, messageId};
//                  "message:delta" {threadId, messageId, delta};
//                  "message:end" {threadId, message};
//                  "thread:updated" {thread}; "error" {message}
//   Message shape: {id, threadId, role: 'user'|'assistant', content, createdAt}
//
// Path MUST be "/" (Caddy gateway requirement), port 3003 (hardcoded).

import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { db } from "./db-client";
import { verifyWsToken, type WsUser } from "./auth";
import { generateReply, chunkText, type LlmMessage } from "./agent";
import { deriveThreadTitle } from "./prompts";

const PORT = 3003;
const MAX_CONTENT_LENGTH = 20000;
const HISTORY_LIMIT = 30;

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to forward to this port.
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─────────────────────────── helpers ───────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MessageRow {
  id: string;
  threadId: string;
  role: string;
  content: string;
  createdAt: Date;
}

/** Prisma row → wire shape (contract message shape, ISO date). */
function serializeMessage(m: MessageRow) {
  return {
    id: m.id,
    threadId: m.threadId,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

// Concurrency guard: one agent turn per thread at a time.
const runningThreads = new Map<string, true>();

// ─────────────────────────── agent turn ───────────────────────────

/**
 * Stage-0 agent turn:
 *  1. persist user message → emit "message:user"
 *  2. emit "agent:thinking"
 *  3. load last 30 messages (user/assistant only)
 *  4. LLM call (2 retries / 800ms backoff inside agent.ts)
 *  5. create assistant row → "message:start" → simulated stream deltas
 *     → persist final content → "message:end"
 *  6. auto-title brand-new threads → "thread:updated" to the user room
 */
async function runAgentTurn(socket: Socket, user: WsUser, threadId: string, content: string): Promise<void> {
  const room = `thread:${threadId}`;

  try {
    // 1. Persist user message.
    const userMessage = await db.message.create({
      data: { threadId, role: "user", content },
    });
    await db.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    io.to(room).emit("message:user", { message: serializeMessage(userMessage) });

    // 2. Thinking indicator.
    io.to(room).emit("agent:thinking", { threadId });

    // 3. History for the LLM (user/assistant only, oldest → newest).
    const rows = await db.message.findMany({
      where: { threadId, role: { in: ["user", "assistant"] } },
      orderBy: { createdAt: "asc" },
      take: -HISTORY_LIMIT, // last 30, still ascending
    });
    const history: LlmMessage[] = rows
      .filter((r) => r.content.trim().length > 0)
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));

    // 4. LLM call.
    const reply = await generateReply(history);

    // 5. Assistant row first (empty) → stream → persist → end.
    let assistantMessage = await db.message.create({
      data: { threadId, role: "assistant", content: "" },
    });
    io.to(room).emit("message:start", { threadId, messageId: assistantMessage.id });

    const chunks = chunkText(reply);
    for (const delta of chunks) {
      io.to(room).emit("message:delta", { threadId, messageId: assistantMessage.id, delta });
      await sleep(25 + Math.random() * 10); // ~25–35ms per chunk
    }

    assistantMessage = await db.message.update({
      where: { id: assistantMessage.id },
      data: { content: reply },
    });
    io.to(room).emit("message:end", {
      threadId,
      message: serializeMessage(assistantMessage),
    });

    // 6. Auto-title for fresh threads.
    await maybeAutoTitle(threadId, user.sub);
  } catch (err) {
    console.error(
      `[agent] turn failed (thread ${threadId}):`,
      err instanceof Error ? err.message : String(err),
    );
    socket.emit("error", { message: "Не удалось получить ответ. Попробуйте ещё раз." });
  }
}

/** If the thread is still untitled and this is one of its first 2 messages —
 *  derive a short title from the first user message and notify the user room. */
async function maybeAutoTitle(threadId: string, userId: string): Promise<void> {
  const thread = await db.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.userId !== userId || thread.title !== "Новый диалог") return;

  const count = await db.message.count({ where: { threadId } });
  if (count > 2) return;

  const firstUser = await db.message.findFirst({
    where: { threadId, role: "user" },
    orderBy: { createdAt: "asc" },
  });
  if (!firstUser) return;

  const title = deriveThreadTitle(firstUser.content);
  if (!title) return;

  const updated = await db.thread.update({ where: { id: threadId }, data: { title } });
  io.to(`user:${userId}`).emit("thread:updated", {
    thread: {
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

// ─────────────────────────── connection handling ───────────────────────────

io.on("connection", async (socket: Socket) => {
  // Auth: { token } in the handshake auth field.
  const token = (socket.handshake.auth as { token?: unknown })?.token;
  if (typeof token !== "string" || !token) {
    socket.emit("error", { message: "Не авторизован" });
    socket.disconnect(true);
    return;
  }

  const user = await verifyWsToken(token);
  if (!user) {
    socket.emit("error", { message: "Не авторизован" });
    socket.disconnect(true);
    return;
  }

  socket.data.user = { userId: user.sub, email: user.email, name: user.name, role: user.role };
  socket.join(`user:${user.sub}`);
  console.log(`[ws] connected: ${user.email} (${socket.id})`);

  // ── thread:join {threadId} ──
  socket.on("thread:join", async (payload: unknown) => {
    try {
      const { threadId } = (payload ?? {}) as { threadId?: unknown };
      if (typeof threadId !== "string" || !threadId) {
        socket.emit("error", { message: "Некорректный запрос" });
        return;
      }
      const thread = await db.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== user.sub) {
        socket.emit("error", { message: "Диалог не найден" });
        return;
      }
      socket.join(`thread:${threadId}`);
    } catch (err) {
      console.error("[ws] thread:join failed:", err instanceof Error ? err.message : String(err));
      socket.emit("error", { message: "Диалог не найден" });
    }
  });

  // ── thread:leave {threadId} ──
  socket.on("thread:leave", (payload: unknown) => {
    const { threadId } = (payload ?? {}) as { threadId?: unknown };
    if (typeof threadId !== "string" || !threadId) {
      socket.emit("error", { message: "Некорректный запрос" });
      return;
    }
    socket.leave(`thread:${threadId}`);
  });

  // ── message:send {threadId, content} ──
  socket.on("message:send", async (payload: unknown) => {
    try {
      const { threadId, content } = (payload ?? {}) as { threadId?: unknown; content?: unknown };
      if (typeof threadId !== "string" || !threadId || typeof content !== "string") {
        socket.emit("error", { message: "Некорректный запрос" });
        return;
      }
      const text = content.trim();
      if (!text) {
        socket.emit("error", { message: "Сообщение не может быть пустым" });
        return;
      }
      if (text.length > MAX_CONTENT_LENGTH) {
        socket.emit("error", { message: `Сообщение слишком длинное (максимум ${MAX_CONTENT_LENGTH} символов)` });
        return;
      }

      const thread = await db.thread.findUnique({ where: { id: threadId } });
      if (!thread || thread.userId !== user.sub) {
        socket.emit("error", { message: "Диалог не найден" });
        return;
      }

      // One agent turn per thread at a time.
      if (runningThreads.has(threadId)) {
        socket.emit("error", { message: "Агент ещё отвечает…" });
        return;
      }

      runningThreads.set(threadId, true);
      try {
        // Make sure the sender receives thread room events even if they
        // skipped an explicit thread:join.
        socket.join(`thread:${threadId}`);
        await runAgentTurn(socket, user, threadId, text);
      } finally {
        runningThreads.delete(threadId);
      }
    } catch (err) {
      console.error("[ws] message:send failed:", err instanceof Error ? err.message : String(err));
      socket.emit("error", { message: "Не удалось отправить сообщение" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[ws] disconnected: ${user.email} (${socket.id})`);
  });
});

// ─────────────────────────── boot ───────────────────────────

async function main() {
  // Shared SQLite: enable WAL + busy timeout so the Next.js app and this
  // service can write concurrently without "database is locked" errors.
  try {
    await db.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
    await db.$queryRawUnsafe("PRAGMA busy_timeout=5000;");
  } catch (err) {
    console.warn(
      "[db] WAL/busy_timeout pragma failed (continuing):",
      err instanceof Error ? err.message : String(err),
    );
  }

  httpServer.listen(PORT, () => {
    console.log(`agent-service listening on ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[agent-service] fatal boot error:", err);
  process.exit(1);
});

// Graceful shutdown.
process.on("SIGTERM", () => {
  console.log("[agent-service] SIGTERM, shutting down…");
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
});
process.on("SIGINT", () => {
  console.log("[agent-service] SIGINT, shutting down…");
  io.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
});
