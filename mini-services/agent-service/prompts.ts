// PocketStudio agent prompts — mode-aware cockpit, shared identity from src/lib/ai/prompts.ts

import {
  IDENTITY_BLOCK,
  JSON_TOOL_CONTRACT,
  OUTPUT_PROSE_CONTRACT,
  RAG_GLOBAL_BLOCK,
  RAG_WORKSPACE_BLOCK,
  wrapSkillDocs,
} from "../../src/lib/ai/prompts";

export type ThreadModeName = "ask" | "plan" | "act" | "review";

const TOOLS_BLOCK = `Доступные инструменты (ключи args — английские):
- create_note {"text","category_name?","workspaceId?"}
- search_notes {"query","limit?"}
- list_notes {"limit?"}
- open_note {"noteId"}
- tag_note {"noteId","tags":["…"]}
- set_reminder {"noteId","at":"ISO-8601"}
- retrieve_canon {"query","kinds"?} — RAG: заметки, главы, сущности, код, скиллы. Скоуп = этот чат
- retrieve_code {"query"} — то же, только файлы (kinds: file)
- create_document {"title","content","sectionTitle?","kind?"}
- append_section {"documentId","title","content"}
- rewrite_section {"documentId?","action":"write|rewrite|continue","instruction?"}
- create_entity {"kind","name","short?","description?","workspaceId?"}
- check_document {"documentId?"}
- generate_image {"prompt","title?","projectId?"}
- tts_narration {"text","title?","voice?","projectId?"}
- open_in_design {"artifactId?"}
- apply_filter {"filter":"bright|contrast|sat|bw"}
- create_project {"name","description?","note_id?"}
- list_projects {}
- list_files {"path?"}
- read_file {"path"}
- write_file {"path","content"} — полный файл, только «Действовать»
- apply_patch {"path","oldText","newText"} или {"path","patch"} — точечная правка, только «Действовать»
- delete_file {"path"}
- checkpoint {"message?"}
- complete_task {"task":номер 1-based}
- fetch_url {"url"} — прочитать http(s) страницу (MCP fetch)
- web_search {"query","num?"} — поиск в сети (MCP fetch)
- browser_read {"url"} — живой браузер; если CLI нет, инструмент честно откажет
- deploy_project {"workspaceId?"} — ZIP + Dockerfile + docker build только для приложения; пустой не «собрано»; без Docker — unavailable в чат; не публикация

Правила выбора: мысль → create_note; «вспомни/найди в каноне» → retrieve_canon; глава сценария с нуля → rewrite_section action write или create_document; кадр → generate_image; озвучка → tts_narration. Ссылка → fetch_url; «найди в интернете» → web_search. Не предлагай create_project, код приложения и deploy_project — студии разработки в интерфейсе нет. В чате воркспейса не спрашивай id — инструменты возьмут контекст и не выйдут за рамки воркспейса.`;

const MODE_PROMPTS: Record<ThreadModeName, string> = {
  ask: `Режим «Спросить»: отвечай и разбирай. Разрешено: заметки, retrieve_canon, retrieve_code, чтение файлов, документы/сущности/картинка/озвучка/аналитик.
Запрещено: write_file, apply_patch, delete_file, checkpoint, create_project.
Сначала retrieve_canon, если вопрос про канон, персонажей или сюжет. Если замысел фильма сырой — максимум 2 уточняющих вопроса, затем предложи план (не 7-шаговое интервью).`,
  plan: `Режим «План»: сначала контекст (retrieve_canon / retrieve_code / list_notes / list_files), затем план. Не меняй файлы и не создавай проекты.

Завершающий ответ ОБЯЗАН содержать в конце:
\`\`\`план
- [ ] Первый шаг — конкретное действие
- [ ] Второй шаг
\`\`\`
3–8 шагов, один маркер на строку, до 120 символов, без нумерации. Не планируй работу, которую пользователь не просил. Не планируй файлы вне активного проекта. Если нужен проект, а его нет — первый шаг «Создать проект …». Для кода последний шаг — проверка/чекпоинт. Перед блоком — 1–3 предложения.`,
  act: `Режим «Действовать»: полная свобода инструментов. Перед правкой канона или кода вызови retrieve_canon / retrieve_code. Существующий файл — apply_patch; новый — write_file. После серий правок — checkpoint. Шаги плана отмечай complete_task сразу после выполнения. Не пиши файлы вне корня активного проекта. Не давай финальный текст, пока выполненные шаги не отмечены.`,
  review: `Режим «Ревью»: только чтение (list_files, read_file, retrieve_canon, retrieve_code). Оценивай код и тексты: проблемы, риски, улучшения. Предлагай правки сниппетами \`\`\`diff. Не изменяй файлы. Опирайся только на прочитанное — не выдумывай пути.`,
};

export function buildAgentSystemPrompt(opts: {
  mode: string;
  ragScope?: "global" | "workspace";
  projectName?: string | null;
  projectType?: string | null;
  projectOrigin?: string | null;
  projectTree?: string[];
  recentCommits?: string[];
  studios?: { name: string; type: string }[];
  planTasks?: { text: string; done: boolean }[];
  mcpToolDocs?: string[];
  filesystemOff?: boolean;
  skillDocs?: string[];
}): string {
  const modeName: ThreadModeName =
    opts.mode === "plan" || opts.mode === "act" || opts.mode === "review"
      ? opts.mode
      : "ask";

  const ragScope = opts.ragScope ?? (opts.projectName ? "workspace" : "global");
  const ragBlock = ragScope === "workspace" ? RAG_WORKSPACE_BLOCK : RAG_GLOBAL_BLOCK;

  let prompt = [
    IDENTITY_BLOCK,
    ragBlock,
    JSON_TOOL_CONTRACT,
    TOOLS_BLOCK,
    OUTPUT_PROSE_CONTRACT,
    MODE_PROMPTS[modeName],
  ].join("\n\n");

  if (ragScope === "global" && (opts.studios?.length ?? 0) > 0) {
    prompt += `\n\nСтудии пользователя:\n${opts.studios!
      .slice(0, 30)
      .map((s) => `- ${s.name} (${s.type})`)
      .join("\n")}`;
  }

  const projectName = (opts.projectName ?? "").trim();
  if (projectName) {
    const tree = (opts.projectTree ?? []).slice(0, 40);
    const commits = (opts.recentCommits ?? []).slice(0, 5);
    const origin = (opts.projectOrigin ?? "").trim();
    const lines: string[] = [
      `Активный проект: ${projectName}${origin ? ` (origin: ${origin})` : ""}. Пиши только в эти пути.`,
      opts.projectType && opts.projectType !== "app"
        ? `Тип воркспейса: ${opts.projectType}.`
        : "",
      "Структура (до 40 путей):",
      ...(tree.length > 0 ? tree.map((p) => `- ${p}`) : ["- (пусто)"]),
    ].filter(Boolean);
    if (commits.length > 0) {
      lines.push("Последние коммиты:");
      lines.push(...commits.map((c) => `- ${c}`));
    }
    prompt += `\n\n${lines.join("\n")}`;
  }

  const tasks = (opts.planTasks ?? []).slice(0, 20);
  if (tasks.length > 0) {
    prompt += `\n\nПлан работ диалога:\n${tasks
      .map((t, i) => `${i + 1}. ${t.text}${t.done ? " [выполнено]" : ""}`)
      .join("\n")}`;
  }

  const docs = (opts.mcpToolDocs ?? []).filter((d) => d.trim().length > 0);
  if (docs.length > 0) {
    prompt += `\n\nИнтеграции MCP:\n${docs.map((d) => `- ${d}`).join("\n")}\nСсылка → fetch_url; browser_read — только по явной просьбе или если страница не читается.`;
  }
  if (opts.filesystemOff) {
    prompt +=
      "\n\nВНИМАНИЕ: Filesystem MCP выключен — list_files, read_file, write_file, apply_patch, delete_file, checkpoint недоступны.";
  }

  const skills = wrapSkillDocs(opts.skillDocs ?? []);
  if (skills) prompt += `\n\n${skills}`;

  return prompt;
}

export function deriveThreadTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  if (!singleLine) return "";
  const sixWords = singleLine.split(" ").slice(0, 6).join(" ");
  if (sixWords.length <= 50) return sixWords;
  const cut = sixWords.slice(0, 50);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
}

export function buildPlannerPrompt(opts: {
  projectName?: string | null;
  projectTree?: string[];
  hasProject: boolean;
}): string {
  const lines: string[] = [
    "Ты — Планировщик PocketStudio. Разбей запрос на короткий список шагов для штурмана.",
    "",
    "Ответь ТОЛЬКО JSON без markdown:",
    '{"steps":["Первый шаг","Второй шаг","Третий шаг"]}',
    "",
    "Требования:",
    "- 3–6 шагов или [] если это простой вопрос/разговор",
    "- каждый шаг — одно действие до 120 символов, по-русски",
    "- не выдумывай работу, которую пользователь не просил (урок proto2 Planner)",
    "- не планируй файлы вне активного проекта",
    "- если нужен проект, а его нет — первый шаг «Создать проект …»",
    "- шаги выполнимы инструментами: заметка, retrieve_canon, документ, сущность, картинка, озвучка, файлы, apply_patch, чекпоинт",
    "- для кода последний шаг — проверка или чекпоинт",
  ];

  if (opts.hasProject) {
    lines.push("");
    lines.push(
      `Активный проект: ${opts.projectName ?? "проект"}. Уже есть файлы (не планируй создавать существующие):`,
    );
    const tree = (opts.projectTree ?? []).slice(0, 40);
    lines.push(...(tree.length > 0 ? tree.map((p) => `- ${p}`) : ["- (пусто)"]));
  }

  return lines.join("\n");
}

export function buildReviewerPrompt(planTasks: { text: string; done: boolean }[]): string {
  const lines: string[] = [
    "Ты — Ревьюер PocketStudio. Исполнитель закончил работу. Напиши финальный отчёт пользователю.",
    "В истории видны JSON-вызовы и [TOOL_RESULT] — это не слова пользователя.",
    "",
    "По-русски, дружелюбно, 4–8 предложений:",
    "- что реально сделано по каждому шагу (опирайся только на историю инструментов, как proto2 Reviewer)",
    "- какие файлы созданы или изменены (пути)",
    "- одно предложение «что дальше»",
    "",
    "Без JSON, без слова «инструмент», без выдуманных действий.",
  ];

  const tasks = planTasks.slice(0, 20);
  if (tasks.length > 0) {
    lines.push("");
    lines.push("План работ диалога:");
    lines.push(
      ...tasks.map((t, i) => `${i + 1}. ${t.text}${t.done ? " [выполнено]" : ""}`),
    );
  }

  return lines.join("\n");
}
