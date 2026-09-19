# Prototype port — gap analysis

`prototypes/proto1` is an **empty directory** in this repo. Proto1 (VibeMind)
behavior is reconstructed from `worklog.md` and already-migrated notebook code.
`prototypes/proto2/Aiflow-main` is present; Gitea, BullMQ, and Docker sandboxes stay replaced per `worklog.md`. **PostgreSQL + pgvector RAG is required** (not a leftover toy): main chat sees the current user's workspaces; workspace chat never leaves that `Project.id`. A personal coder in an app workspace must not see another repo.

## proto1 VibeMind

| Feature | Status |
|---|---|
| Notes + ASR + 4-block analysis + categories | Already in product |
| ⌘K / Ctrl+K capture + composer mic | Already in product |
| Onboarding tour | Already in product; Quest now pre-fills chat after first thought |
| Note tags UX | **Ported** — Tag/NoteTag were in schema, now API + chips + `tag_note` |
| Reminders | **Ported** — `Note.remindAt`, filter, datetime in note detail, `set_reminder` |
| Notebook activity chart | **Ported** — 14-day bars (`GET /api/notes/stats`) |
| Admin 14-day stacked chart | Already in admin |
| Quest dialog with selected note | **Ported** as onboarding Quest → capture → composer draft (not a separate QuestMessage table) |
| TTS voice picker | **Ported labels** — OpenAI alloy/nova/…; legacy z-ai ids still mapped in the gateway |

## proto2 Aiflow / AI Studio

| Feature | Status |
|---|---|
| ask/plan/act/review + planner/reviewer | Already in agent-service; prompts merged (see `docs/PROMPTS.md`) |
| File tree, Monaco, checkpoints, zip | Already in product |
| iframe preview | Already static HTML; **click-to-inspect DOM + “ask agent”** added (фаза E lite) |
| Hot-reload of a Next dev server | **Impossible here** without a per-user daemon. Inspector has «Обновить» for static HTML. |
| apply-patch | **Ported** as `apply_patch` (exact replace + tiny unified diff) |
| RAG / pgvector | **In product** — `RagChunk` + retrieve scoped by user/workspace. SQLite substring leftover replaced. |
| Gitea | Keep local git |
| BullMQ | Keep in-process analyzer poll |
| MCP | Builtin adapters already; stdio honest “saved, not started” |
| Dockerfile + template | Already; template branding → PocketStudio |
| Multi-agent Analyst→Coder pipeline | User-visible as modes + sub-agents, not Docker-Gitea workers |

## Honest leftover (blocked)

- Legal occupancy search for the name «PocketStudio»
- Live card network (adapter fields + UX exist; `PAYMENTS_API_KEY` still not a real Stripe charge)
- 2-hour Netflix pipeline (badge only)
- ffmpeg in this sandbox: used when present; otherwise canvas WebM
- Email password reset: SMTP is not in the product. Profile can change a password with the current one; we do not fake a letter.
