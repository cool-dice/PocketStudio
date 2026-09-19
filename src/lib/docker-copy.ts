/**
 * Honest deploy copy + empty-app detection.
 * Generating a Dockerfile is not publishing an image.
 * An empty tree must not look «собрано».
 */

const SCAFFOLD_FILES = new Set([
  "dockerfile",
  ".dockerignore",
  ".gitignore",
  "readme.md",
  "license",
  "license.md",
  ".gitkeep",
]);

export const DOCKERFILE_NOT_PUBLISHED =
  "Dockerfile сохранён в проекте. Образ не собран и не опубликован.";

export const EMPTY_APP_BUILD_ERROR =
  "Пустой воркспейс: нет исходников для сборки образа. Добавьте файлы приложения.";

export const DOCKERFILE_MISSING_ERROR =
  "Сначала сгенерируйте Dockerfile — без него docker build запускать нечего.";

export const DOCKER_DAEMON_MISSING_LOG =
  "Docker CLI есть, но демон не запущен. Запустите Docker Desktop / dockerd и повторите. Образ не опубликован.";

export const DOCKER_BUILD_LOCAL_ONLY =
  "Образ собран локально. В реестр ничего не уходило — это не публикация.";

export const DEPLOY_APP_ONLY_ERROR =
  "Сборка Docker доступна только для воркспейсов типа «приложение». Книги, фильмы, музыка и универсальные студии так не деплоятся — скачайте ZIP на экране «Деплой». Это не публикация образа.";

export const DEPLOY_ZIP_HINT =
  "ZIP исходников можно скачать на экране «Деплой». Это архив, не публикация.";

const TYPE_LABELS: Record<string, string> = {
  film: "фильм",
  book: "книга",
  music: "музыка",
  app: "приложение",
  universal: "универсальный",
};

export function deployWrongTypeMessage(type: string): string {
  const label = TYPE_LABELS[type] ?? type;
  return (
    `Сборка Docker доступна только для воркспейсов типа «приложение». ` +
    `Этот воркспейс — «${label}». Скачайте ZIP на экране «Деплой» — это не публикация образа.`
  );
}

export function dockerCliMissingLog(projectId: string, root: string): string {
  const tag = `pocketstudio/${projectId.slice(0, 8)}`;
  return (
    "docker CLI не найден в PATH. Соберите образ локально:\n" +
    `  docker build -t ${tag} ${root}\n` +
    "Это локальная сборка, не публикация в реестр."
  );
}

export function isScaffoldFile(relPath: string): boolean {
  const base = relPath.replace(/\\/g, "/").split("/").pop() ?? relPath;
  return SCAFFOLD_FILES.has(base.toLowerCase());
}

/** True when the tree has at least one non-scaffold source file. */
export function hasBuildableAppFiles(
  entries: { path: string; type: string }[],
): boolean {
  return entries.some(
    (entry) => entry.type === "file" && !isScaffoldFile(entry.path),
  );
}

export function hasDockerfile(
  entries: { path: string; type: string }[],
): boolean {
  return entries.some(
    (entry) =>
      entry.type === "file" &&
      (entry.path === "Dockerfile" || entry.path.endsWith("/Dockerfile")),
  );
}
