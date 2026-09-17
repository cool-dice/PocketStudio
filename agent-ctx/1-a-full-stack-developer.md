# Task 1-a — Notes + Categories REST API (work record)

Agent: full-stack-developer | Status: DONE, verified

## Files created (5)
- `src/lib/note-utils.ts` — COLOR/ICON allowlists (as const arrays + type guards), `noteWithCategory(note)` → `{id, rawText, status, favorite, createdAt, category: {id,name,color,icon}|null}`. Client-safe (no server-only imports, no Prisma import — structural types). Exports: `COLORS`, `ICONS`, `CategoryColor`, `CategoryIcon`, `isCategoryColor`, `isCategoryIcon`, `CategoryShape`, `NoteShape`, `noteWithCategory`.
- `src/app/api/notes/route.ts` — GET (filters + pagination) + POST.
- `src/app/api/notes/[id]/route.ts` — GET / PATCH / DELETE.
- `src/app/api/categories/route.ts` — GET (list w/ noteCount).
- `src/app/api/categories/[id]/route.ts` — PATCH / DELETE.

## API behavior (exactly per Task 4 contract)
- All routes: `export const dynamic = "force-dynamic"`, `getUserFromRequest` → 401 `{error:"Требуется авторизация"}` when null. Ownership scoping everywhere via `findFirst({where:{id, userId}})` → 404.
- GET /api/notes: filters `categoryId` (exact), `favorite=1` (only literal "1"), `q` (substring on rawText, **Unicode case-insensitive incl. Cyrillic** — see note below), `page` ≥1 default 1, `limit` 1..50 default 20; orderBy createdAt desc; `{notes:[noteWithCategory...], total, hasMore}` with `hasMore = page*limit < total`. Invalid page/limit → 400 with Russian message.
- POST /api/notes: `{text 1..5000 (trimmed), categoryId?}`; categoryId ownership → 404 `"Категория не найдена"`; creates status "pending"; → 201 `{note}` (with nested category when provided).
- GET/PATCH/DELETE /api/notes/[id]: 404 `"Заметка не найдена"`; PATCH `{favorite?, categoryId? (string|null — null clears), rawText 1..5000}` → `{note}` (category validated for ownership, update with include → nested category in response).
- GET /api/categories: `{categories:[{id,name,color,icon,noteCount}]}`, noteCount via `_count`, orderBy name asc.
- PATCH /api/categories/[id]: `{name? 1..40, color? z.enum(COLORS), icon? z.enum(ICONS)}` → `{category:{id,name,color,icon,createdAt,noteCount}}` (superset of list-item shape — createdAt/noteCount included so frontend can update state without refetch); duplicate name (P2002 on @@unique([userId,name])) → 409 `"Категория с таким названием уже существует"`; 404 `"Категория не найдена"`.
- DELETE /api/categories/[id] → `{ok:true}`; attached notes get categoryId null (SetNull, schema-level — verified live).
- zod 4.3.5 for all bodies (string shorthand error messages confirmed working); query params parsed manually (matches 2-a threads convention); invalid JSON → 400 `"Некорректный JSON в запросе"`.

## Design note: q search
SQLite `LIKE`/`lower()` are ASCII-only → plain Prisma `contains` would be case-SENSITIVE for Russian. Implemented Unicode-safe search: fetch candidate ids+rawText (scoped by userId + other filters) → JS `.toLowerCase().includes()` filter → `id IN (...)` + count/findMany. Also avoids LIKE wildcard injection (%, _ literal). Note: `?q=кофе` must be URL-encoded by the client (raw non-ASCII bytes in the request line get rejected by Next with an empty 400 before reaching the route — browsers/fetch always encode).

## Verification (all PASS, localhost:3000 + cookie jars)
- 401s without cookie (notes list, categories list, patch note).
- Register test-notes@vf.io + test-notes-2@vf.io (both role client; real admin untouched).
- POST note → 201 {note, status pending, favorite false, category null}; POST w/ categoryId → nested category; empty/whitespace text → 400 Russian field error; 5001 chars → 400; bad/foreign categoryId → 404; broken JSON → 400.
- List: total/hasMore math verified (2 notes, limit=1 → page1 hasMore true, page2 false); favorite=1 filters; q=кофе matches "КОФЕ" and q=ИДЕЯ matches "Идея" (Cyrillic case-insensitive both directions); q no-match → `{notes:[],total:0,hasMore:false}`; q+favorite combined; limit=51/page=0/page=abc → 400.
- PATCH note: favorite+category, foreign category → 404, rawText update, categoryId:null clears, empty rawText → 400.
- GET note by id → {note w/ category}; nonexistent → 404; cross-user GET/PATCH/DELETE → 404; user2 sees only own notes.
- Categories: list name asc w/ noteCount (0 and 1); PATCH name/color/icon → {category}; invalid color/icon/name>40 → 400; duplicate name → 409; foreign PATCH/DELETE → 404; DELETE category w/ 2 attached notes → ok + both notes category:null (SetNull verified) + favorite preserved; DELETE note → ok, then 404.
- `bun run lint` → 0 problems (whole project). dev.log: no compile/type/runtime errors across all requests.

## Cleanup
- Deleted ONLY test-notes@vf.io and test-notes-2@vf.io via Prisma deleteMany (cascaded notes/categories → counts 0). Real user game.puzzles.a1@gmail.com (admin) untouched.
- FYI for main agent: leftover user `qa-round1@vf.io` (role client) exists from Task 4 QA round — not touched by me (out of scope), may want cleanup.

## For 1-c (frontend) / 1-b (agent tools)
- Import `COLORS`/`ICONS` from `@/lib/note-utils` for chips/icons rendering (same allowlists the API validates against).
- `favorite` filter param is literal `favorite=1`.
- PATCH category response includes createdAt + noteCount (superset of list shape).
- Categories are NOT created via REST (no POST /api/categories by contract) — creation happens via 1-b agent tool create_note (or future UI); tests created categories via direct Prisma inserts.
