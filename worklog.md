# Unified App — Worklog

Project: merge of two prototypes (VibeMind + Aiflow/AI Studio) into a single Next.js 16 application.

---
Task ID: 0
Agent: main
Task: Analyze uploaded prototype archives and prepare a merge plan for user approval (no coding yet).

Work Log:
- Extracted `/home/z/my-project/upload/1.zip` (GNU tar, not zip) → `/home/z/my-project/prototypes/proto1` = **VibeMind** (working MVP).
- Extracted `/home/z/my-project/upload/Aiflow-main.zip` → `/home/z/my-project/prototypes/proto2/Aiflow-main` = **AI Studio / Aiflow** (Lerna/Yarn monorepo, partially implemented).
- Studied VibeMind: schema (User, Insight, AnalysisResult, AnalysisRevision, QuestMessage, Tag, InsightTag, ErrorLog, SystemSetting, AIProvider), API routes (capture, insights, quest, tags, admin), pipeline (ASR → classify → 4-block analysis), UI (capture screen, insights list, analysis view, quest dialog, stats, admin panel, onboarding). Russian UI, Next.js 16 + SQLite + z-ai-web-dev-sdk. Single `/` route, client-side view switching.
- Studied Aiflow: 17 spec docs in docs/, apps/web (Next.js 15, React 18, chat AG-UI, files+RAG LlamaIndex/pgvector, Monaco editor, Gitea integration), apps/worker (BullMQ), services (model-router, registry-proxy), packages (ai-roles, crypto, db, queue, ui). Requires PostgreSQL/Redis/MinIO/Gitea/Docker sandboxes — NOT available in this sandbox.
- Mapped Aiflow features → sandbox-compatible adaptations (SQLite instead of Postgres schemas, in-process pipeline instead of BullMQ/Redis, DB-backed commits instead of Gitea, direct LLM codegen instead of Aider-in-Docker, local FS instead of MinIO).
- Prepared merge plan (concept: unified AI workspace, "thought → analysis → project" bridge between VibeMind and AI Studio pipeline Analyst → Planner → Coder → Reviewer → Export).

Stage Summary:
- Both prototypes fully analyzed; merge plan presented to user for approval.

---
Task ID: 0-b
Agent: main
Task: Incorporate user feedback and produce revised preliminary plan (v2) for approval. No coding yet.

Work Log:
- User feedback parsed: notebook-first (notes are the core, app-creation optional); dynamic categories (LLM picks or creates categories, no hard-coded 4); note↔project relations (suggest link / propose edits / keep as note); full auth with roles client+admin only (Analyst/Engineer are IDE work MODES, not roles; editor view = just a button); Monaco; WebSocket (chat becomes primary interaction); OpenUI as design basis + light customization; honest queue analysis (drop delayed delivery).
- Strategic pivot: user reframed the product around Cursor as reference — the IDE itself becomes the agent (no Aider, no external coding agents). Sub-agents, planning, orchestration. Key feature: end-to-end flow idea → MVP.
- Open-source agent references selected for feature adoption: Cline/Roo Code (plan/act modes, checkpoints, tool approvals), OpenHands (event stream architecture), Aider (repo map, edit formats), Claude Code (sub-agents, TodoWrite-style planning, slash commands).
- Verified OpenUI capabilities in proto2: @openuidev/react-headless (useThread/useThreadList/agUIAdapter/ChatLLM, AG-UI protocol) + @openuidev/react-ui (ConversationStarter, MarkDownRenderer, labels) + packages/ui token layer (Button/Card/Input/Spinner + theme.css).
- Verified proto2 worker already has OpenAI-style tool definitions (spec_generate, list_tasks, run_planner, run_coder, deploy, list_files, read_file) — reusable pattern for our agent tool protocol.
- Produced revised plan v2 (phases 0–5: foundation+auth+WS → notebook → chats → agent act/tools/Monaco → sub-agents/orchestration → e2e+admin+export) and presented to user.

Stage Summary:
- Plan v2 presented. Key architecture: Next.js 16 on :3000 (REST + UI), socket.io mini-service on :3003 (chat transport + agent orchestrator runs there), shared SQLite (Prisma, WAL), z-ai-web-dev-sdk LLM in WS service, virtual project FS in DB (files+snapshots+commits), WS auth via short-lived token endpoint. Deferred cron setup until development actually starts (user explicitly wants approval first).

---
Task ID: 0-c
Agent: main
Task: Storage revision per user feedback — real files + real Git instead of DB virtual FS; project import (GitHub/ZIP); base Next.js template; deploy deferred (Vercel later). Plan v3 for final approval. No coding yet.

Work Log:
- User feedback: no DB virtual FS — wants real Git + real files so users can import existing projects (GitHub or ZIP). Wants a ready app template (like this sandbox's Next.js stack) as the base for new projects. Autodeploy deferred; later maybe Vercel push. Asks whether a DB should still be laid out.
- Verified in sandbox: git 2.47.3 present; network access to GitHub works (git ls-remote ok); /home/z/my-project is itself a git repo.
- Revised storage architecture (v3):
  - Disk: workspace/<projectId>/ real folders with real .git; templates/ vendored in repo; public/uploads for media; projects excluded from Next.js src watching.
  - Git ops server-side via fixed-argv child_process (init/add/commit/log/diff/revert/stash) — no shell interpolation, agent never runs raw git.
  - Import: GitHub https clone (public now, token later) + ZIP upload (unzip, sanitize paths, size limits).
  - Template: vendored Next.js 16 + TS + Tailwind 4 + shadcn + Prisma/SQLite starter; new project = copy + git init + initial commit; template versioned & upgradable.
  - SQLite (Prisma) REMAINS essential for platform data: users/sessions/roles, notes/categories/tags/favorites, project metadata (rootPath, remoteUrl, templateVersion), chat threads/messages, agent runs + event journal, plans/tasks, settings, AI providers, audit. Files+history live in git; DB indexes/caches search metadata.
  - Checkpoints = git commits/stash; diff/revert native git; Monaco edits real files; agent file tools sandboxed to project root.
  - Vercel later: real git repo makes it a plain integration (vercel CLI / API or git push to user remote).
- Stage plan updated: Stage 0 adds workspace layout + template vendoring + git-ops lib; Stage 3 file tools on real FS; Stage 5 import flows + zip export (exclude node_modules) + Vercel stub.

Stage Summary:
- Plan v3 (storage revised) presented to user for final approval. Dual storage: disk+git for project sources/history, SQLite for all platform data. Git binary + GitHub network confirmed working in sandbox.

---
Task ID: 0-d
Agent: main
Task: Write detailed textual UI/UX spec + user flows (guest → first note → idea-to-MVP; import; admin) for user alignment before approval. No coding yet.

Work Log:
- Described design system: OpenUI components + stone/emerald token layer, dark/light, Russian microcopy, minimal Cursor-like density in workspace.
- Screen map: Landing (guest) → Auth → Onboarding → Shell (sidebar: Блокнот/Проекты/Уведомления/Профиль + Админка) → Notebook (capture + feed + note detail drawer with 4-block analysis & discussion) → Projects (list + create/import dialog) → Project Workspace (file tree left, agent chat center-primary, Monaco secondary via tabs, plan panel, modes Ask/Plan/Act/Review, diff cards, checkpoints, git history) → Admin (users/providers/settings/audit).
- Flows: (A) guest registers → first note → WS notif → analysis; (B) note → project → interview → /spec → plan → act → export; (C) GitHub import → ask about code; (D) note↔project relation detector.
- States: empty/loading/error, WS reconnect badge, mobile adaptations (bottom nav, chat-first, editor as sheet).

Stage Summary:
- UI/UX textual spec delivered to user for review/alignment. Awaiting approval (or edits) before Stage 0 start.

---
Task ID: 0-e
Agent: main
Task: Revise concept per user: chat becomes THE main component of the whole app (chat-first shell), agent understands global intents (create project/note, link entities). Plan v4 for approval. No coding yet.

Work Log:
- User pivot: chat-first architecture — like Cursor, chat is the main control window of the entire app, not just project workspace. Agent must route global intents: create new project, create note, link note to existing projects/notes.
- Redesigned shell: center = main chat (home screen after login); left sidebar = threads + collections (Блокнот, Проекты) + notifications/profile; right = adaptive context panel (note detail / files+Monaco / plan / diffs) driven by both agent and user.
- Agent gets platform-wide tool layer: notebook tools (create/search/open/link notes, categories), project tools (create from template/note/idea, import github/zip, open, files, git, checkpoints), meta tools (global search, help).
- Quick capture preserved as zero-latency path: ⌘K palette / FAB + voice — note lands in notebook without agent roundtrip; agent references it in chat.
- Collections (notes feed, projects grid) remain as browse/manage screens; clicking an entity returns to chat with it in context.
- Mobile becomes naturally chat-first (right panel → sheet).
- Stages reordered: WS chat service + chat-first shell moved INTO Stage 0 foundation (home screen is chat); Stage 1 = agent core with tool-calling; Stage 2 = notebook; Stage 3 = projects/Act; Stage 4 = orchestration; Stage 5 = polish/export/admin.

Stage Summary:
- Plan v4 (chat-first cockpit) presented to user for approval. Chat = main control surface with global intent routing; notebook/projects are collections + context panel; quick capture kept latency-free via ⌘K.
