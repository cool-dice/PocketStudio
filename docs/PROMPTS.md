# PocketStudio prompts

Inventory of every LLM surface. Winners are implemented in
`src/lib/ai/prompts.ts` (shared) and `mini-services/agent-service/prompts.ts`
(cockpit). Tool ids match `src/lib/ai/tools.ts`.

## Shared blocks (kept)

| ID | Where | What won | Why |
|---|---|---|---|
| `identity` | `IDENTITY_BLOCK` + `RAG_GLOBAL_BLOCK` / `RAG_WORKSPACE_BLOCK` | PocketStudio «штурман студии», chat-first, RAG isolation | Proto2 Analyst interview (7 stages) is too slow for a cockpit. PocketStudio identity was already the right voice; compressed sidebar tour. |
| `json_tool_contract` | `JSON_TOOL_CONTRACT` | One `{"tool","args"}` per turn + one few-shot | Proto2 used native tool-calling in the worker. Product already parses JSON; few-shot reduces fence/chained-object errors without bloating. |
| `output_prose` | `OUTPUT_PROSE_CONTRACT` | Short Russian (user language) prose | Matches UI. Internal JSON keys stay English. |

## Tool-id system prompts

| Tool id | File / constant | Kept from | Discarded |
|---|---|---|---|
| `agent` | `buildAgentSystemPrompt` | PocketStudio modes ask/plan/act/review + proto2 “don’t invent / stay in repo / grounded review” | Proto2 24-task Aider planner, English-only coder report, Docker sandbox rules |
| `notes` | `NOTES_ANALYSIS_SYSTEM` | **proto1 VibeMind 4-block JSON** (positive/negative/final/recommendations) | Longer 60–120 always; ChatGLM tone |
| `document_check` | `DOCUMENT_ANALYST_SYSTEM` | PocketStudio findings JSON | Invented quotes; proto2 Reviewer verdict for *code* (wrong surface) |
| `describe` | `DESCRIBE_SYSTEM` | PocketStudio entity writer | Generic “you are a helpful assistant” |
| `palette` | `PALETTE_SYSTEM` | PocketStudio art-director JSON | Extra mood essays |
| `monetize` | `MONETIZE_SYSTEM` | PocketStudio producer JSON | Stripe/legal fantasy |
| `rewrite_section` | `SECTION_*_SYSTEM` + `sectionSystemFor` | PocketStudio rewrite/continue/custom **plus write-for-empty** | Routing empty chapters through rewrite (weaker drafts) |
| `image` / `tts` / `asr` | capabilities, not chat roles | `composeImagePrompt` studio prefix; OpenAI voice ids in UI | z-ai voice names in user copy (API still maps tongtong→alloy) |

## Agent tools added to the prompt

`retrieve_canon` / `retrieve_code` (pgvector RAG + keyword fallback in the same scope), `apply_patch`, `tag_note`, `set_reminder`, `fetch_url` / `web_search` / `browser_read` (MCP builtin; browser_read honest if CLI missing), `deploy_project` (app-only ZIP/Dockerfile/docker-build; empty not built; no fake publish).

## Mode merge (proto2 → PocketStudio)

| Mode | Winner |
|---|---|
| ask | PocketStudio: answer + notes/canon/read. Proto2 interview cut to “max 2 clarifying questions”. |
| plan | PocketStudio ` ```план ` checklist **plus** proto2: don’t invent work, don’t plan files outside the open project, last code step = verify/checkpoint. |
| act | PocketStudio tool loop (one JSON/turn) **plus** proto2 coder: prefer patch, stay in tree, complete_task. |
| review | PocketStudio user-facing Russian **plus** proto2: grounded in tool trail, propose `diff`, never write. |
| planner sub-agent | Short Russian `{"steps"}` (user sees the checklist). Discarded proto2 20–24 English Aider tasks. |
| reviewer sub-agent | PocketStudio report to the user. Discarded proto2 ACCEPTED/REJECTED JSON (no sandbox gate here). |

## Skills

Enabled `SKILL.md` bodies inject via `wrapSkillDocs`: playbook, not a second identity. Catalog bodies in `src/lib/skills-catalog.ts` stay short step lists.

Image prompts always get `IMAGE_PROMPT_PREFIX` via `composeImagePrompt` (no vendor watermark, prefix is not duplicated).

## Few-shot policy

Only the tool-call example in `JSON_TOOL_CONTRACT`. Extra shots for analysis/palette/monetize were not added: those schemas are already short and parsed leniently.

## Discarded outright

- z-ai / ChatGLM vendor voice (including «Тонгтунг» labels in video TTS)
- VibeFlow product name in prompts
- proto2 Analyst SPEC.md 7-stage interview as the default chat
- proto2 Coder “never commit / ESLint 200 lines” (that was the Aider sandbox, not this agent)
- Long duplicated tool essays inside each SKILL.md
