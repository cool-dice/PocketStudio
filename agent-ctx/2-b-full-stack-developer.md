# Task 2-b — WS agent mini-service (socket.io :3003)

Agent: full-stack-developer
Status: DONE — service implemented, verified (unit + smoke + 22/22 e2e checks), started on :3003.

## Files (all inside `mini-services/agent-service/`)
- `package.json` — exactly `{"name":"agent-service","private":true,"scripts":{"dev":"bun --hot index.ts"}}`. No own node_modules (deps resolve from root).
- `index.ts` — bootstrap: env fallbacks (`DATABASE_URL=file:/home/z/my-project/db/custom.db`, `AUTH_SECRET=vf-local-dev-secret-9f2c`) BEFORE dynamic import of server.
- `auth.ts` — `verifyWsToken(token)`: jose HS256; first try audience "ws" (ws-token from main app `GET /api/auth/ws-token`), fallback jwtVerify without audience (session cookie tokens). Returns `{sub,email,name,role}` or null.
- `db-client.ts` — re-exports `db` from `../../src/lib/db` (ONE prisma client & schema).
- `prompts.ts` — `AGENT_SYSTEM_PROMPT` (Russian VibeFlow cockpit stub, 2–5 sentences, honest capability intro) + `deriveThreadTitle` (first 6 words, ≤50 chars, single line).
- `agent.ts` — Stage-0 LLM loop: cached `ZAI.create()`; `generateReply(history)` = [system, ...history] with `thinking:{type:"disabled"}`, 2 retries / 800ms backoff; `chunkText` (4–10 word lossless chunks for simulated streaming).
- `server.ts` — socket.io Server on httpServer, `path:"/"`, cors `*`, pingTimeout 60000 / pingInterval 25000, port 3003 hardcoded. Boot: WAL + busy_timeout=5000 pragmas on shared SQLite.

## WS contract implemented (EXACT)
Client→server (all validated: typeof + thread ownership via db):
- `thread:join {threadId}` → join `thread:<id>`; foreign/missing → error `Диалог не найден`
- `thread:leave {threadId}`
- `message:send {threadId, content}` → trim, non-empty (error `Сообщение не может быть пустым`), ≤20000 chars, ownership, busy-guard per thread (error `Агент ещё отвечает…`)

Server→client:
- `message:user {message:{id,threadId,role:"user",content,createdAt(ISO)}}`
- `agent:thinking {threadId}`
- `message:start {threadId,messageId}`
- `message:delta {threadId,messageId,delta}` (25–35ms apart)
- `message:end {threadId,message:{id,threadId,role:"assistant",content,createdAt(ISO)}}`
- `thread:updated {thread:{id,title,updatedAt(ISO)}}` → to room `user:<userId>` (auto-title)
- `error {message}` — auth: `Не авторизован` (+disconnect(true)); LLM failure: `Не удалось получить ответ. Попробуйте ещё раз.`

Rooms: `user:<sub>` on connect; `thread:<threadId>` for thread events. Message:send auto-joins sender to the thread room (robustness).

## Verification (all real, nothing faked)
1. z-ai SDK probe: role `"system"` works natively (model glm-4-plus; `choices[0].message.content`). No proto1 system→assistant mapping needed.
2. `verifyWsToken` unit: ws-token(aud ws) ✓ · session(no aud) ✓ · bad secret→null ✓ · expired→null ✓ · garbage→null ✓.
3. `generateReply` smoke with fake history: 984ms, Russian VibeFlow-branded reply; `chunkText` lossless (join(chunks) === original).
4. E2E via socket.io-client + temp DB users/threads (cleaned up): **22/22 PASS** — bad-token disconnect, both token types connect, ownership rejections, full turn (message:user → thinking → start → deltas → end), lossless stream, busy guard, auto-title (≤50 chars), DB persistence (2 rows, content match), cascade cleanup.
5. `bunx eslint mini-services/agent-service/` — clean.

## Notes for parallel agents (2-a auth, 2-c frontend)
- Frontend connect: `io("/?XTransformPort=3003", { path: "/", auth: { token } })` — token from `GET /api/auth/ws-token` (audience "ws", 60s) or the session JWT.
- The `thread:updated` event also fires when the title is auto-derived after the 1st exchange — sidebar should refresh the thread list.
- Sandbox note: this environment reaps background processes between agent tool sessions; service verified & left running, restart with `cd mini-services/agent-service && bun run dev` if needed.
- WAL mode is now enabled persistently on `db/custom.db` (aligns with Task 1 "shared SQLite (Prisma, WAL)").
