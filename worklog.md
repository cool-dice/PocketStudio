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
