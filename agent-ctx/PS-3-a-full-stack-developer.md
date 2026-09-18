# Task PS-3-a — Frontend: Home dashboard + Workspaces list + Create wizard (PocketStudio)

Agent: full-stack-developer
Status: DONE — golden path verified via agent-browser (session ps3a, desktop 1440×900 + mobile 390×844), lint clean, tsc clean (only 4 pre-existing debts elsewhere).

## Files (all in src/components/workspaces/)
- `home-data.ts` (157) — NEW: HOME_STATS, HOME_ACTIVITY (8 events, type-colored tones), homeDateLine/firstNameOf.
- `home-activity.tsx` (67) — NEW: activity feed, item click → openWorkspace.
- `home-recent.tsx` (119) — NEW: «Продолжить работу» rich cards (gradient tile, type+stage badges, progress, artifacts count, hover lift).
- `home-screen.tsx` (193) — REWRITTEN from foundation stub: greeting hero + quick-start (wizard / setCaptureOpen / setMainArea("chat")), lg 2fr+1fr layout with stats + quick-access aside, mobile-only compact header with hamburger.
- `workspaces-data.ts` (77) — NEW: sort options/type chips labels, multi-token search, sortWorkspaces.
- `workspaces-filters.tsx` (139) — NEW: search + sort Select + type chips with faceted counts.
- `workspaces-card.tsx` (186) — NEW: gradient cover + stage badge overlay, favorite star (sibling button — no nested interactive), progress + counts row + «Открыть».
- `workspaces-screen.tsx` (187) — REWRITTEN from stub: ModuleHeader + «Создать воркспейс», filters, 1→2→3 grid, favorites Set + toast, empty state + reset.
- `create-workspace-dialog.tsx` (222) + `create-workspace-steps.tsx` (265) — NEW: 3-step wizard (Тип/Название/Готово), stepper, pipeline chips preview; create → WorkspaceSummary → `useAppUi.getState().openWorkspaceData(ws, "overview")` → PS-3-b shell resolves override.

## Key decisions / deviations
- Wizard reset on close via intercepting onOpenChange (NOT useEffect) — `react-hooks/set-state-in-effect` rule blocks sync setState in effect body; event-handler context is the sanctioned pattern in this repo.
- No ModuleHeader on desktop Home — greeting hero is the anchor; mobile gets compact hamburger header (nav access on 390px is mandatory).
- Chip labels exactly per task: Все/Фильмы/Книга/Музыка/Приложение/Универсальный with live faceted counts (Все 6 / Фильмы 2 / …).
- Created workspace persists only as `activeWorkspaceOverride` while open (store untouched — visual wave; list still shows 6 mocks).
- Imported (never edited) PS-3-b's `overview-data.ts` helpers (pluralArtifacts) and foundation's canonical data.

## Verification highlights (agent-browser, gateway :81, ps2c-audio@vf.io)
- Home: hero «Привет, Тест!», 3 quick buttons all wired (capture dialog opens, chat nav works), 3 recent cards → shell, 8 activity items → shell, stats 6/17/12/4, quick-access → Library (PS-3-c).
- Workspaces: chips filter (Фильмы → 2), search «фьорд»+chip → empty state → «Сбросить» → 6 back; sort by progress/name verified; favorite star toggle + toast.
- Wizard full flow: Фильм → «Тестовый фильм» → preview pipeline → «Создать» → PS-3-b shell on Обзор («Конвейер фильма», stage Сценарий, NEXT_STEP_PROMPTS renders, 0% «только что»). Enter-to-advance, «Назад» preserves state, «Изменить тип» keeps selection, cancel+reopen resets. Re-verified after file split.
- Mobile 390px: no horizontal overflow (scrollWidth=390) on both screens; wizard opens; chips scroll.
- Console errors 0, page errors 0. Screenshots: tool-results/ps3a-*.png.

## Ops note for main
- Dev server hung after a turbopack panic (concurrent writes by 4 parallel agents); killed the wedged `next dev` — `mini-services/agent-service/next-supervisor.sh` auto-restarted it (Ready in 927ms, turbopack cache cleared).
- If lint runs on the whole repo during PS-3 wave: transient errors may appear in PS-3-d's in-flight files (e.g. workspace-chat-tab.tsx refs rule) — not mine; my 10 files pass eslint scoped.
