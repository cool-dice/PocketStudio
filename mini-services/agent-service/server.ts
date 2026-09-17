// agent-service — socket.io transport + Stage-1 agent turn orchestration
// (tool-calling loop over the notebook tools).
//
// Contract (worklog Tasks 1 & 4):
//   Client→server: "thread:join" {threadId}; "thread:leave" {threadId};
//                  "message:send" {threadId, content}
//   Server→client: "message:user" {message}; "agent:thinking" {threadId};
//                  "message:start" {threadId, messageId};
//                  "message:delta" {threadId, messageId, delta};
//                  "message:end" {threadId, message};
//                  "tool:start" {threadId, messageId, tool, args};
//                  "tool:end" {threadId, messageId, tool, args, result};
//                  "thread:updated" {thread}; "error" {message}
//   Message shape: {id, threadId, role: 'user'|'assistant', content, createdAt}
//
// Agent turn = up to 6 LLM iterations. Each LLM reply is either plain text
// (→ streamed to the client via message:start/delta/end, loop ends) or a JSON
// tool call (→ tool row persisted, tool executed, tool:start/tool:end emitted,
// result fed back into the next LLM call via [TOOL_CALL]/[TOOL_RESULT]
// history markers).
//
// Path MUST be "/" (Caddy gateway requirement), port 3003 (hardcoded).

import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { db } from "./db-client";
import { verifyWsToken, type WsUser } from "./auth";
import {
  generateLLMResponse,
  parseToolCall,
  chunkText,
  type LlmMessage,
} from "./agent";
import { AGENT_SYSTEM_PROMPT, deriveThreadTitle } from "./prompts";
import { getTool } from "./tools";

const PORT = 3003;
const MAX_CONTENT_LENGTH = 20000;
const HISTORY_LIMIT = 30; // last N message rows fed to the LLM (all roles)
const MAX_TOOL_ITERATIONS = 6; // hard cap on LLM round-trips per turn
const TURN_TIMEOUT_MS = 120000; // total turn budget
const MAX_TOOL_RESULT_CHARS = 8000; // stored toolResult JSON cap
const TOOL_RESULT_HISTORY_CHARS = 2000; // toolResult cap inside LLM history
const FALLBACK_REPLY =
  "Я обработал запрос, но что-то пошло не так — попробуйте переформулировать.";

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
  toolName?: string | null;
  toolArgs?: string | null;
  toolResult?: string | null;
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
 * LLM history from the last HISTORY_LIMIT message rows of the thread:
 *  - user/assistant rows → {role, content} as-is (empty assistant stubs skipped)
 *  - tool rows → rendered in the SAME shape as the wire protocol so the
 *    model never sees a second format it could mimic:
 *      assistant: {"tool":"<name>","args":{...}}
 *      user:      [TOOL_RESULT] <toolResult ≤2000 chars>
 *    Tool rows still marked "pending" (crashed turn) are skipped entirely.
 */
async function buildLLMHistory(threadId: string): Promise<LlmMessage[]> {
  const rows = await db.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    take: -HISTORY_LIMIT, // last 30 rows, still ascending
  });

  const history: LlmMessage[] = [];
  for (const row of rows) {
    if (row.role === "user" || row.role === "assistant") {
      if (!row.content.trim()) continue;
      history.push({ role: row.role, content: row.content });
    } else if (row.role === "tool") {
      if (!row.toolResult || row.toolResult === "pending") continue;
      const result =
        row.toolResult.length > TOOL_RESULT_HISTORY_CHARS
          ? row.toolResult.slice(0, TOOL_RESULT_HISTORY_CHARS)
          : row.toolResult;
      // The call, exactly as the model itself would emit it (assistant role) …
      history.push({
        role: "assistant",
        content: `{"tool":${JSON.stringify(row.toolName ?? "unknown")},"args":${row.toolArgs ?? "{}"}}`,
      });
      // … and the result as a user-role system-ish message.
      history.push({
        role: "user",
        content: `[TOOL_RESULT] ${result}`,
      });
    }
  }
  return history;
}

/**
 * Clean a would-be plain-text LLM answer: strip leaked protocol artifacts
 * ([TOOL_CALL …] / [TOOL_RESULT …] lines, bare tool-JSON objects). Returns
 * null when nothing human-readable remains (caller should keep looping).
 */
function sanitizeTextAnswer(raw: string): string | null {
  let text = raw;
  // 1. Remove whole-line protocol markers.
  text = text
    .split("\n")
    .filter((line) => !/^\s*\[(TOOL_CALL|TOOL_RESULT)/i.test(line))
    .join("\n");
  // 2. Remove a bare JSON tool object if it is the entire message.
  const trimmed = text.trim();
  if (/^\{\s*"tool"\s*:/.test(trimmed)) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj?.tool === "string") return null; // pure tool JSON → not text
    } catch {
      // fall through — partial JSON mixed with prose, keep going
    }
  }
  const cleaned = text.trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Stream a final text answer to the thread room (emulated streaming):
 * assistant row (empty) → message:start → message:delta ×N → persist →
 * message:end.
 */
async function streamFinalResponse(
  room: string,
  threadId: string,
  text: string,
): Promise<void> {
  let assistantMessage = await db.message.create({
    data: { threadId, role: "assistant", content: "" },
  });
  io.to(room).emit("message:start", { threadId, messageId: assistantMessage.id });

  const chunks = chunkText(text);
  for (const delta of chunks) {
    io.to(room).emit("message:delta", { threadId, messageId: assistantMessage.id, delta });
    await sleep(25 + Math.random() * 10); // ~25–35ms per chunk
  }

  assistantMessage = await db.message.update({
    where: { id: assistantMessage.id },
    data: { content: text },
  });
  io.to(room).emit("message:end", {
    threadId,
    message: serializeMessage(assistantMessage),
  });
}

/**
 * Stage-1 agent turn (tool-calling loop):
 *  1. persist user message → emit "message:user" → bump thread.updatedAt
 *  2. up to MAX_TOOL_ITERATIONS LLM iterations:
 *       - "agent:thinking" (before every LLM call, incl. the first)
 *       - history = last 30 rows (user/assistant + [TOOL_CALL]/[TOOL_RESULT])
 *       - LLM reply parses as a tool call? → persist tool row ("pending") →
 *         emit "tool:start" → execute tool → persist result (≤8000 chars) →
 *         emit "tool:end" → next iteration sees the result in history
 *       - plain text? → streamFinalResponse, loop ends
 *  3. loop exhausted / turn timeout (>120s) without a text answer →
 *     stream a fallback message
 *  4. auto-title brand-new threads → "thread:updated" to the user room
 * Never throws — failures emit "error" to the triggering socket.
 */
async function runAgentTurn(socket: Socket, user: WsUser, threadId: string, content: string): Promise<void> {
  const room = `thread:${threadId}`;
  const turnStart = Date.now();

  try {
    // 1. Persist user message.
    const userMessage = await db.message.create({
      data: { threadId, role: "user", content },
    });
    await db.thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    io.to(room).emit("message:user", { message: serializeMessage(userMessage) });

    // 1b. Auto-title fresh threads EARLY (before any answer streams) so
    // that nothing slow remains after the final message:end emit — this
    // keeps the busy-flag race window at effectively zero.
    await maybeAutoTitle(threadId, user.sub);

    // 2. Tool-calling loop.
    let answered = false;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (Date.now() - turnStart > TURN_TIMEOUT_MS) break;

      // Thinking indicator (before the first LLM call and between iterations).
      io.to(room).emit("agent:thinking", { threadId });

      const history = await buildLLMHistory(threadId);
      const raw = await generateLLMResponse(AGENT_SYSTEM_PROMPT, history);

      const call = parseToolCall(raw);
      if (!call) {
        // Would-be plain text: strip leaked protocol artifacts first.
        const clean = sanitizeTextAnswer(raw);
        if (clean) {
          await streamFinalResponse(room, threadId, clean);
          answered = true;
          break;
        }
        // Nothing human-readable left (model emitted protocol garbage) —
        // keep looping; the model gets another chance to answer properly.
        continue;
      }

      // Tool call → persist a "pending" tool row first (it becomes the
      // message id reported to the client).
      const toolMessage = await db.message.create({
        data: {
          threadId,
          role: "tool",
          content: "",
          toolName: call.tool,
          toolArgs: JSON.stringify(call.args),
          toolResult: "pending",
        },
      });
      io.to(room).emit("tool:start", {
        threadId,
        messageId: toolMessage.id,
        tool: call.tool,
        args: call.args,
      });

      // Execute (never throws into the loop — errors become tool results).
      let result: unknown;
      try {
        const tool = getTool(call.tool);
        result = tool
          ? await tool.execute(call.args, user.sub)
          : { error: `Неизвестный инструмент: ${call.tool}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }

      const resultJson = (JSON.stringify(result) ?? "{}").slice(0, MAX_TOOL_RESULT_CHARS);
      await db.message.update({
        where: { id: toolMessage.id },
        data: { toolResult: resultJson },
      });
      io.to(room).emit("tool:end", {
        threadId,
        messageId: toolMessage.id,
        tool: call.tool,
        args: call.args,
        result,
      });
      // Loop continues — the next iteration sees [TOOL_CALL]/[TOOL_RESULT].
    }

    // 3. Loop exhausted or timed out without a text answer → fallback.
    if (!answered) {
      await streamFinalResponse(room, threadId, FALLBACK_REPLY);
    }

    // NOTE: nothing slow may happen after the final message:end emit —
    // the busy flag clears right after this function returns, and a
    // client that sends its next message on message:end would otherwise
    // race into "Агент ещё отвечает…". Auto-title moved to the turn start.
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
