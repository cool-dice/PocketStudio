// PocketStudio workspace — real files + real git on disk.
//
// Pure Node module: NO "@/..." path aliases, NO database imports, NO
// framework types — so it can be imported BOTH by the Next.js app
// (src/app/api/projects/**) and by the agent-service
// (mini-services/agent-service, via a relative import) under bun.
//
// Layout: every project lives at WORKSPACE_ROOT/<projectId>/ with its own
// .git repository. Checkpoints = plain git commits. The database stores only
// platform metadata (Project row with rootPath etc.) — never file contents.

import { execFile } from "node:child_process";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";

// ─────────────────────────── roots ───────────────────────────

export const WORKSPACE_ROOT =
  process.env.VIBEFLOW_WORKSPACE_ROOT ?? path.resolve(process.cwd(), "workspace");

export const TEMPLATE_ROOT =
  process.env.VIBEFLOW_TEMPLATE_ROOT ??
  path.resolve(process.cwd(), "templates/nextjs-basic");

const GIT_IDENTITY = [
  "-c",
  "user.name=PocketStudio Agent",
  "-c",
  "user.email=agent@pocketstudio.local",
];

// ─────────────────────────── limits ───────────────────────────

export const MAX_FILE_BYTES = 256 * 1024; // read/write cap per file
export const MAX_TREE_ENTRIES = 2000; // flat file-tree cap
const MAX_COMMITS_LISTED = 100;
const GIT_TIMEOUT_MS = 30_000;
const CLONE_TIMEOUT_MS = 120_000;

// ─────────────────────────── types ───────────────────────────

export interface FileEntry {
  path: string; // relative, POSIX separators, no leading ./
  type: "file" | "dir";
  size: number; // bytes for files, 0 for dirs
}

export interface CommitInfo {
  hash: string; // full sha
  short: string; // 7-char sha
  message: string;
  author: string;
  date: string; // ISO
}

export interface CheckpointResult {
  noop: boolean;
  commit: CommitInfo | null;
  filesChanged: number;
}

// ─────────────────────────── errors ───────────────────────────

/** Thrown for all workspace-level failures (bad path, missing file, git…). */
export class WorkspaceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "WorkspaceError";
    this.status = status;
  }
}

// ─────────────────────────── git helpers ───────────────────────────

function run(
  cwd: string,
  args: string[],
  timeoutMs = GIT_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(
            new WorkspaceError(
              stderr?.trim() || err.message || "git failed",
              500,
            ),
          );
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });
}

/** git with the PocketStudio agent identity (commits stay attributable). */
function git(cwd: string, args: string[], timeoutMs?: number) {
  return run(cwd, [...GIT_IDENTITY, ...args], timeoutMs);
}

// ─────────────────────────── paths ───────────────────────────

const FORBIDDEN_SEGMENTS = new Set([".git", "node_modules"]);

/** Absolute dir for a project id. */
export function projectRoot(projectId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new WorkspaceError("Некорректный идентификатор проекта");
  }
  return path.join(WORKSPACE_ROOT, projectId);
}

/**
 * Resolve a relative path inside a project root, guarding against traversal
 * (…/…), absolute paths, Windows drive letters and .git / node_modules.
 * Returns the absolute path (dirs are NOT resolved through symlinks —
 * symlinks are simply never created inside workspaces).
 */
export function safeJoin(root: string, relPath: string): string {
  if (typeof relPath !== "string") {
    throw new WorkspaceError("Путь должен быть строкой");
  }
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!normalized || normalized === ".") return root;

  const segments = normalized.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === ".." || FORBIDDEN_SEGMENTS.has(s))) {
    throw new WorkspaceError("Путь вне проекта запрещён");
  }
  if (segments.some((s) => !/^[^:\u0000]*$/.test(s))) {
    throw new WorkspaceError("Недопустимые символы в пути");
  }

  const abs = path.join(root, ...segments);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) {
    throw new WorkspaceError("Путь вне проекта запрещён");
  }
  return abs;
}

/** POSIX-style relative path for display/transport. */
export function toRel(root: string, abs: string): string {
  const rel = path.relative(root, abs);
  return rel.split(path.sep).join("/");
}

// ─────────────────────────── file ops ───────────────────────────

/** Read a text file (≤256KB, rejects binary content) → {path, content, size}. */
export async function readWorkspaceFile(
  root: string,
  relPath: string,
  maxBytes = MAX_FILE_BYTES,
): Promise<{ path: string; content: string; size: number }> {
  const abs = safeJoin(root, relPath);
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    throw new WorkspaceError("Файл не найден", 404);
  }
  if (!stat.isFile()) throw new WorkspaceError("Это не файл", 400);
  if (stat.size > maxBytes) {
    throw new WorkspaceError(`Файл больше ${maxBytes} байт`, 413);
  }

  const buf = await fsp.readFile(abs);
  // NUL byte in the first 8KB → treat as binary.
  const probe = buf.subarray(0, Math.min(8192, buf.length));
  if (probe.includes(0)) {
    throw new WorkspaceError("Бинарные файлы не поддерживаются", 415);
  }
  return { path: toRel(root, abs), content: buf.toString("utf8"), size: buf.length };
}

/** Write a text file (creates parent dirs). Returns {path, size, created}. */
export async function writeWorkspaceFile(
  root: string,
  relPath: string,
  content: string,
  maxBytes = MAX_FILE_BYTES,
): Promise<{ path: string; size: number; created: boolean }> {
  if (typeof content !== "string") {
    throw new WorkspaceError("Содержимое должно быть строкой");
  }
  if (content.length > maxBytes) {
    throw new WorkspaceError(`Файл больше ${maxBytes} байт`, 413);
  }
  const abs = safeJoin(root, relPath);
  const segments = toRel(root, abs).split("/");
  if (segments.length === 0) {
    throw new WorkspaceError("Путь должен указывать на файл");
  }
  const fileName = segments[segments.length - 1];
  if (!fileName.trim()) throw new WorkspaceError("Имя файла пустое");

  let created = true;
  try {
    await fsp.stat(abs);
    created = false;
  } catch {
    // not found → will be created
  }
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, "utf8");
  return { path: toRel(root, abs), size: Buffer.byteLength(content, "utf8"), created };
}

/** Delete a file or an empty/non-empty dir tree inside the project. */
export async function deleteWorkspacePath(
  root: string,
  relPath: string,
): Promise<{ deleted: true; path: string }> {
  const abs = safeJoin(root, relPath);
  if (abs === root) throw new WorkspaceError("Нельзя удалить корень проекта");
  await fsp.rm(abs, { recursive: true, force: true });
  return { deleted: true as const, path: toRel(root, abs) };
}

// ─────────────────────────── tree & stats ───────────────────────────

/** Flat, sorted file listing (dirs + files), excluding .git / node_modules. */
export async function listWorkspaceTree(
  root: string,
  maxEntries = MAX_TREE_ENTRIES,
): Promise<{ entries: FileEntry[]; truncated: boolean }> {
  const entries: FileEntry[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (entries.length >= maxEntries) {
      truncated = true;
      return;
    }
    let dirents;
    try {
      dirents = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir → skip silently
    }
    dirents.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    for (const d of dirents) {
      if (FORBIDDEN_SEGMENTS.has(d.name)) continue;
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }
      const abs = path.join(dir, d.name);
      const rel = toRel(root, abs);
      if (d.isDirectory()) {
        entries.push({ path: rel, type: "dir", size: 0 });
        await walk(abs);
      } else if (d.isFile()) {
        let size = 0;
        try {
          size = (await fsp.stat(abs)).size;
        } catch {
          // vanished mid-walk → keep with size 0
        }
        entries.push({ path: rel, type: "file", size });
      }
    }
  }

  await walk(root);

  // Sort: dirs first is unnecessary — plain path sort reads well in the UI.
  entries.sort((a, b) => a.path.localeCompare(b.path, "ru"));
  return { entries, truncated };
}

/** Count committable files (excluding .git / node_modules). */
export async function countWorkspaceFiles(root: string): Promise<number> {
  const { entries } = await listWorkspaceTree(root, MAX_TREE_ENTRIES);
  return entries.filter((e) => e.type === "file").length;
}

// ─────────────────────────── git: init / checkpoint / log ───────────────────────────

/** git init (+ initial commit) inside an existing project directory. */
export async function initProjectGit(
  root: string,
  initialMessage = "Чекпоинт 0: проект создан",
): Promise<void> {
  await run(root, ["init", "-b", "main"]);
  await git(root, ["add", "-A"]);
  // Empty tree (possible for degenerate zips) → nothing to commit, that's ok.
  try {
    await git(root, ["commit", "-m", initialMessage]);
  } catch {
    // ignore — repo simply has zero commits
  }
}

/** Parse one `git log --pretty` line into a CommitInfo. */
function parseCommitLine(line: string): CommitInfo | null {
  const [hash, message, author, date] = line.split("\u0001");
  if (!hash || !date) return null;
  return {
    hash,
    short: hash.slice(0, 7),
    message: message ?? "(без сообщения)",
    author: author ?? "PocketStudio Agent",
    date,
  };
}

/** Commit all changes. No changes → {noop: true}. */
export async function checkpointProject(
  root: string,
  message: string,
): Promise<CheckpointResult> {
  const trimmed = message.trim();
  if (!trimmed) throw new WorkspaceError("Сообщение чекпоинта пустое");

  const status = await git(root, ["status", "--porcelain"]);
  const files = status.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (files.length === 0) {
    return { noop: true, commit: null, filesChanged: 0 };
  }

  await git(root, ["add", "-A"]);
  await git(root, ["commit", "-m", trimmed]);
  const commit = await lastCommit(root);
  return { noop: false, commit, filesChanged: files.length };
}

/** Latest commit of the repo (null for a repo with zero commits). */
export async function lastCommit(root: string): Promise<CommitInfo | null> {
  try {
    const out = await git(root, [
      "log",
      "-1",
      "--pretty=%H\u0001%s\u0001%an\u0001%aI",
    ]);
    return parseCommitLine(out.stdout.trim());
  } catch {
    return null;
  }
}

/** Commit history, newest first. */
export async function listProjectCommits(
  root: string,
  limit = 50,
): Promise<CommitInfo[]> {
  const capped = Math.max(1, Math.min(limit, MAX_COMMITS_LISTED));
  try {
    const out = await git(root, [
      "log",
      `-n`,
      String(capped),
      "--pretty=%H\u0001%s\u0001%an\u0001%aI",
    ]);
    return out.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parseCommitLine)
      .filter((c): c is CommitInfo => c !== null);
  } catch {
    return [];
  }
}

/** Total commit count (0 for a fresh repo). */
export async function countProjectCommits(root: string): Promise<number> {
  try {
    const out = await git(root, ["rev-list", "--count", "HEAD"]);
    return Number(out.stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/** Is there uncommitted work? */
export async function hasUncommittedChanges(root: string): Promise<boolean> {
  try {
    const out = await git(root, ["status", "--porcelain"]);
    return out.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// ─────────────────────────── git: commit diff (Stage 4) ───────────────────────────

export type DiffFileStatus = "added" | "modified" | "deleted";

export interface CommitDiffFile {
  path: string;
  status: DiffFileStatus;
  /** Content before the commit ("" for added files). */
  original: string;
  /** Content after the commit ("" for deleted files). */
  modified: string;
  /** Content was larger than the cap → truncated (UI shows a notice). */
  truncated: boolean;
  /** File is binary or too large to show → contents omitted. */
  skipped: boolean;
}

export interface CommitDiff {
  commit: CommitInfo;
  files: CommitDiffFile[];
  /** Number of changed entries not shown (over the 20-file cap). */
  skippedCount: number;
}

const MAX_DIFF_FILES = 20;
const MAX_DIFF_FILE_BYTES = 200 * 1024;

/** Read `git show <rev>:<path>`; returns null when the path doesn't exist in rev. */
async function showBlob(
  root: string,
  rev: string,
  relPath: string,
): Promise<string | null> {
  try {
    const out = await git(root, ["show", `${rev}:${relPath}`]);
    return out.stdout;
  } catch {
    return null;
  }
}

/**
 * Diff of one commit vs its parent (initial commit → vs empty tree).
 * Uses --name-status to list changes, then loads old/new blobs for the
 * first MAX_DIFF_FILES text files. Binary/huge blobs are marked skipped.
 */
export async function commitDiff(
  root: string,
  hash: string,
): Promise<CommitDiff> {
  if (!/^[0-9a-f]{6,40}$/i.test(hash)) {
    throw new WorkspaceError("Некорректный хеш коммита", 400);
  }

  const commit = await lastCommitAt(root, hash);
  if (!commit) throw new WorkspaceError("Коммит не найден", 404);

  // Files changed by this commit (works for the root commit too, vs empty tree).
  const nameStatus = await git(root, [
    "diff-tree",
    "--no-commit-id",
    "--name-status",
    "-r",
    "--root",
    "-z",
    hash,
  ]);
  const raw = nameStatus.stdout;
  const pairs: { status: string; path: string }[] = [];
  // -z output: STATUS\0PATH\0STATUS\0PATH… (rename/copy have extra path — treated as add).
  const parts = raw.split("\0").filter((p) => p.length > 0);
  for (let i = 0; i < parts.length; i += 2) {
    const status = parts[i];
    const path = parts[i + 1];
    if (!status || !path) continue;
    if (status.startsWith("R") || status.startsWith("C")) {
      // rename/copy: status letter, old path, new path — consume the extra part.
      pairs.push({ status: "A", path: parts[i + 2] ?? path });
      i += 1;
    } else {
      pairs.push({ status, path });
    }
  }

  const parent = `${hash}^`;
  const files: CommitDiffFile[] = [];
  let skippedCount = Math.max(0, pairs.length - MAX_DIFF_FILES);

  for (const { status, path } of pairs.slice(0, MAX_DIFF_FILES)) {
    const normalized = path.replace(/^\/+/, "");
    const statusLetter = status[0]?.toUpperCase() ?? "M";
    const fileStatus: DiffFileStatus =
      statusLetter === "A" ? "added" : statusLetter === "D" ? "deleted" : "modified";

    let original: string | null = null;
    let modified: string | null = null;
    try {
      original = await showBlob(root, parent, normalized);
      modified = await showBlob(root, hash, normalized);
    } catch {
      original = null;
      modified = null;
    }

    if (original === null && modified === null) {
      files.push({ path: normalized, status: fileStatus, original: "", modified: "", truncated: false, skipped: true });
      continue;
    }

    let truncated = false;
    const clip = (s: string | null): string => {
      if (s === null) return "";
      if (Buffer.byteLength(s, "utf8") > MAX_DIFF_FILE_BYTES) {
        truncated = true;
        return s.slice(0, MAX_DIFF_FILE_BYTES);
      }
      return s;
    };
    files.push({
      path: normalized,
      status: fileStatus,
      original: clip(original),
      modified: clip(modified),
      truncated,
      skipped: false,
    });
  }

  return { commit, files, skippedCount };
}

/** CommitInfo for a specific hash (null when unknown). */
async function lastCommitAt(root: string, hash: string): Promise<CommitInfo | null> {
  try {
    const out = await git(root, [
      "show",
      "-s",
      "--pretty=%H\u0001%s\u0001%an\u0001%aI",
      hash,
    ]);
    return parseCommitLine(out.stdout.trim());
  } catch {
    return null;
  }
}

// ─────────────────────────── zip export (Stage 4) ───────────────────────────

const PY_ZIP = `
import os, sys, zipfile

src, dest = sys.argv[1], sys.argv[2]
skip = {".git", "node_modules"}
count = 0

with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(src):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, src)
            z.write(full, rel)
            count += 1

print(count)
`;

/**
 * Zip the project working tree (excluding .git / node_modules) into a temp
 * file → returns its absolute path. Caller removes the file after streaming.
 */
export async function exportProjectZip(root: string): Promise<string> {
  const zipPath = path.join(
    os.tmpdir(),
    `pocketstudio-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`,
  );

  let printedCount = "0";
  await new Promise<void>((resolve, reject) => {
    execFile(
      "python3",
      ["-c", PY_ZIP, root, zipPath],
      { timeout: 120_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new WorkspaceError("Не удалось упаковать проект", 500));
          return;
        }
        printedCount = stdout.toString().trim() || "0";
        void stderr;
        resolve();
      },
    );
  });

  if (Number(printedCount) === 0) {
    await fsp.rm(zipPath, { force: true });
    throw new WorkspaceError("Проект пуст — нечего скачивать", 422);
  }
  return zipPath;
}

// ─────────────────────────── project creation ───────────────────────────

/** Copy the Next.js starter template into dest. */
export async function createFromTemplate(dest: string): Promise<void> {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.cp(TEMPLATE_ROOT, dest, { recursive: true });
}

/**
 * Ensure a workspace (type=app) has files on disk so the code tab can open it.
 * Existing non-empty dirs are left alone.
 */
export async function ensureCodeWorkspace(projectId: string): Promise<string> {
  const root = projectRoot(projectId);
  try {
    const st = await fsp.stat(root);
    if (st.isDirectory()) {
      const entries = await fsp.readdir(root);
      if (entries.some((name) => name !== ".git")) return root;
    }
  } catch {
    // missing dir — provision below
  }
  await createFromTemplate(root);
  await initProjectGit(root);
  return root;
}

/**
 * Clone a GitHub repo (https, github.com only, --depth 1) into dest.
 * SSRF guard: scheme https, host github.com, no userinfo, no port.
 */
export async function createFromGithub(
  remoteUrl: string,
  dest: string,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(remoteUrl);
  } catch {
    throw new WorkspaceError("Некорректный URL репозитория", 400);
  }
  if (parsed.protocol !== "https:") {
    throw new WorkspaceError("Поддерживается только https://", 400);
  }
  if (parsed.hostname !== "github.com") {
    throw new WorkspaceError("Импорт поддерживается только с github.com", 400);
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new WorkspaceError("Некорректный URL репозитория", 400);
  }
  const parts = parsed.pathname.replace(/\.git\/?$/, "").split("/").filter(Boolean);
  if (parts.length !== 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0]) || !/^[A-Za-z0-9_.-]+$/.test(parts[1])) {
    throw new WorkspaceError("Ожидается URL вида https://github.com/владелец/репозиторий", 400);
  }

  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await run(
    WORKSPACE_ROOT,
    [
      "clone",
      "--depth",
      "1",
      "--single-branch",
      remoteUrl,
      dest,
    ],
    CLONE_TIMEOUT_MS,
  ).catch((err: unknown) => {
    throw new WorkspaceError(
      err instanceof WorkspaceError
        ? `Не удалось клонировать репозиторий: ${err.message}`
        : "Не удалось клонировать репозиторий",
      502,
    );
  });
}

// ─────────────────────────── zip import ───────────────────────────

// Zip extraction runs through python3 (zipfile) with explicit zip-slip
// protection: every member is realpath-checked to stay inside dest, absolute
// paths / ".." / symlinks are skipped, entry count and total size are capped.
// When the archive has a single top-level folder it is flattened.
const PY_UNZIP = `
import os, sys, zipfile

src, dest = sys.argv[1], sys.argv[2]
root = os.path.realpath(dest)
max_entries = 5000
max_total = 250 * 1024 * 1024

with zipfile.ZipFile(src) as z:
    names = [i for i in z.infolist() if not i.is_dir()]
    if len(names) > max_entries:
        raise SystemExit("TOO_MANY_ENTRIES")
    total = sum(i.file_size for i in names)
    if total > max_total:
        raise SystemExit("TOO_LARGE")

    members = []
    for i in z.infolist():
        if i.is_dir():
            continue
        target = os.path.realpath(os.path.join(dest, i.filename))
        if not (target == root or target.startswith(root + os.sep)):
            continue
        members.append(i)

    z.extractall(dest, [i.filename for i in members])

    # flatten a single top-level folder
    entries = os.listdir(dest)
    if len(entries) == 1:
        only = os.path.join(dest, entries[0])
        if os.path.isdir(only):
            for item in os.listdir(only):
                os.rename(os.path.join(only, item), os.path.join(dest, item))
            os.rmdir(only)
`;

/**
 * Extract a zip archive into dest (safe, single-root flattening).
 * The archive must have been virus-scanned… well, it is user's own upload —
 * the safety here is filesystem-level containment, that's the honest scope.
 */
export async function createFromZip(
  zipPath: string,
  dest: string,
): Promise<{ entries: number }> {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.mkdir(dest, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    execFile(
      "python3",
      ["-c", PY_UNZIP, zipPath, dest],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          const msg = stderr?.toString().trim();
          if (msg === "TOO_MANY_ENTRIES") {
            reject(new WorkspaceError("В архиве больше 5000 файлов", 413));
          } else if (msg === "TOO_LARGE") {
            reject(new WorkspaceError("Архив распаковывается больше 250 МБ", 413));
          } else if (/bad zip|Bad magic|FileNotFoundError/i.test(msg ?? "")) {
            reject(new WorkspaceError("Не удалось прочитать zip-архив", 422));
          } else {
            reject(new WorkspaceError("Не удалось распаковать архив", 422));
          }
          return;
        }
        resolve();
      },
    );
  });

  const { entries } = await listWorkspaceTree(dest, MAX_TREE_ENTRIES);
  const files = entries.filter((e) => e.type === "file");
  if (files.length === 0) {
    throw new WorkspaceError("В архиве нет файлов", 422);
  }
  return { entries: files.length };
}

/** Remove a whole project directory from disk. */
export async function removeProjectDir(projectId: string): Promise<void> {
  const root = projectRoot(projectId);
  await fsp.rm(root, { recursive: true, force: true });
}

/** Project stats for list/detail responses. */
export async function projectStats(root: string): Promise<{
  filesCount: number;
  commitsCount: number;
  lastCommit: CommitInfo | null;
}> {
  const [files, commits, commit] = await Promise.all([
    countWorkspaceFiles(root),
    countProjectCommits(root),
    lastCommit(root),
  ]);
  return { filesCount: files, commitsCount: commits, lastCommit: commit };
}
