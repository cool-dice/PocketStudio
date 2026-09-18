# Task 2-c — Frontend: landing, auth, chat-first shell, WS chat

Agent: full-stack-developer
Status: DONE — full SPA built and verified end-to-end via agent-browser (all scenarios PASS), lint clean, DB cleaned.

## Files
- `src/app/page.tsx` — rewritten: AuthProvider → BootSkeleton | LandingScreen | SocketProvider(key=user.id) → ThreadsProvider → AppShell.
- `src/components/app/app-shell.tsx` — NEW: h-dvh 3-zone shell; mobile sidebar in Sheet (sr-only title, aria-describedby=undefined).
- `src/lib/types.ts` — User/Thread/ThreadListItem/Message/ChatMessage + all WS payload types + MODE_LABELS + MAX_MESSAGE_LENGTH.
- `src/lib/api.ts` — typed fetch wrappers (ApiError with status+fields): me/login/register/logout/wsToken/listThreads/createThread/getThread/updateThread/deleteThread.
- `src/hooks/use-auth.tsx` — AuthProvider {user, loading, login, register, logout}; /api/auth/me on mount.
- `src/hooks/use-socket.tsx` — io("/?XTransformPort=3003", {path:"/", transports:["websocket","polling"], autoConnect:false, auth: cb-fresh-token-per-attempt}); retry-once on "Не авторизован"; ensureConnected() with 8s timeout. Provider keyed by user id in page.tsx.
- `src/hooks/use-threads.tsx` — full chat state machine: optimistic user msg → message:user replace → agent:thinking → message:start empty bubble → delta append → end finalize; thread:updated (auto-title) → sidebar rename; error → toast + busy unlock + drop empty bubble; switch-away silent DELETE of 0-message threads; reconnect re-join; stale-response guard via selectSeq.
- `src/components/logo.tsx`, `landing/landing-screen.tsx` (hero+mock chat+3 features+3 steps+CTA+sticky footer+auth Dialog+standalone auth), `auth/auth-card.tsx` (tabs, API field errors).
- `src/components/app/`: `sidebar.tsx` (threads list w/ inline rename + AlertDialog delete, Блокнот/Проекты «скоро», bell, profile: theme Switch + Админка(admin) + logout, WS dot), `chat-area.tsx` (auto-scroll 150px + «к новым» pill), `composer.tsx` (auto-grow, Enter=send, busy-disabled, safe-area padding), `message-bubble.tsx` (emerald user right / assistant avatar left, react-markdown lite, streaming caret), `welcome.tsx` («Привет, {first}!» + chips, «Что ты умеешь?» sends), `context-panel.tsx` (collapsible placeholder, xl+).
- Design system in `globals.css` (stone-50/900 + emerald-600/500 tokens, vf-scroll, vf-dot, vf-caret, vf-status-pulse) + layout metadata — from the interrupted prior session, reviewed and kept.

## Lint-rule battles (for future agents)
- React 19 eslint (react-hooks v6) forbids: setState synchronously in effect body → socket lives in `useState(() => io(...))`; mutating state values (`socket.auth = x`) → use the socket.io `auth: (cb) => cb({token})` handshake callback instead (fetches a fresh ws-token on every connect attempt).
- Radix Dialog warning "Missing Description" fires for SheetContent too → `aria-describedby={undefined}` + sr-only SheetTitle.

## CRITICAL testing note
Test through the GATEWAY origin `http://localhost:81/`, never `http://localhost:3000/` — Caddy :81 is what routes `?XTransformPort=3003` to the agent service. On :3000 the socket never connects (Next.js answers every path) and the app shows «переподключение…». Real preview users are on the gateway origin, so production was always fine.

## Verification (agent-browser, session task-03e363425671)
1. Landing renders (hero/features/steps/CTA/footer/theme toggle) — PASS
2. Register ui-test@vf.io → shell + «Привет, UI!» + admin menu item — PASS
3. New dialog → «Привет! Кто ты?» → optimistic bubble → «VibeFlow печатает» caught live → streamed reply finalized, markdown lists render — PASS
4. Auto-title «Привет! Кто ты?» in sidebar+header (thread:updated) — PASS
5. Reload → session persists, auto-select, history, «на связи» — PASS
6. Rename (PATCH) / delete (AlertDialog → switch to next) / logout → landing / dark toggle (html.dark both ways) — PASS
7. Mobile 375px: hamburger → Sheet → select auto-closes; desktop 1440px: 3 zones + context collapse — PASS
8. Jump pill: scroll up → «Прокрутить к новым сообщениям» → click → smooth bottom, pill hides — PASS
9. Empty-thread auto-cleanup on switch-away (DB count confirmed) — PASS
10. Console clean, zero page errors, dev.log clean, eslint 0/0 on all files — PASS
11. Cleanup: threads deleted via UI; test user + auditLogs removed via Prisma → DB 0 rows (first real registration = admin restored)

## Known issues
- Viewport resize mid-chat doesn't refresh the jump pill until the next scroll event (cosmetic).
- agent-service is a background process; restart with `cd mini-services/agent-service && bun run dev` if :3003 is silent.
