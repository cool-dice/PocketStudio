/**
 * Dockerfile generator shared by POST /api/workspaces/[id]/dockerfile
 * and the deploy_project agent tool. Never marks an image as published.
 */

import fs from "node:fs";

import {
  DOCKERFILE_NOT_PUBLISHED,
  hasBuildableAppFiles,
} from "./docker-copy";
import {
  listWorkspaceTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  type FileEntry,
} from "./workspace";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function readPackageJson(root: string): PackageJson | null {
  try {
    const raw = fs.readFileSync(`${root}/package.json`, "utf8");
    const parsed = JSON.parse(raw) as PackageJson;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Runtime profile from real files (package.json, framework markers). */
export function detectDockerfileProfile(
  root: string,
  pkg: PackageJson | null,
  files: FileEntry[],
): { kind: string; dockerfile: string; dockerignore: string } {
  const has = (p: string) => files.some((f) => f.path === p);

  if (pkg) {
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    const scripts = pkg.scripts ?? {};

    if (
      deps["next"] ||
      scripts.build?.includes("next") ||
      has("next.config.ts") ||
      has("next.config.js")
    ) {
      return {
        kind: "Next.js",
        dockerfile: `# Сгенерировано PocketStudio — Next.js (multi-stage)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
`,
        dockerignore: `node_modules
.next
.git
*.log
.env*
`,
      };
    }

    if (deps["vite"]) {
      return {
        kind: "Vite (React)",
        dockerfile: `# Сгенерировано PocketStudio — Vite (React)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
        dockerignore: `node_modules
dist
.git
*.log
.env*
`,
      };
    }

    if (deps["express"] || scripts.start || has("index.js") || has("index.ts")) {
      const entry = has("index.ts") ? "index.ts" : "index.js";
      const cmd = scripts.start ? `["npm", "start"]` : `["node", "${entry}"]`;
      return {
        kind: "Node.js",
        dockerfile: `# Сгенерировано PocketStudio — Node.js
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
${scripts.build ? "RUN npm run build\n" : ""}EXPOSE 3000
CMD ${cmd}
`,
        dockerignore: `node_modules
.git
*.log
.env*
`,
      };
    }

    return {
      kind: "Node.js (без запуска)",
      dockerfile: `# Сгенерировано PocketStudio — Node.js
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
CMD ["node", "index.js"]
`,
      dockerignore: `node_modules
.git
*.log
.env*
`,
    };
  }

  if (has("requirements.txt") || has("main.py") || has("app.py")) {
    return {
      kind: "Python",
      dockerfile: `# Сгенерировано PocketStudio — Python
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
`,
      dockerignore: `__pycache__
*.pyc
.git
.venv
.env*
`,
    };
  }

  if (has("index.html")) {
    return {
      kind: "Статический сайт",
      dockerfile: `# Сгенерировано PocketStudio — статический сайт
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
      dockerignore: `.git
*.log
`,
    };
  }

  return {
    kind: "Универсальный",
    dockerfile: `# Сгенерировано PocketStudio — универсальный контейнер
FROM alpine:3.20
WORKDIR /app
COPY . .
CMD ["sh", "-c", "echo 'Нет источника запуска — дополните Dockerfile'"]
`,
    dockerignore: `.git
*.log
`,
  };
}

export type DockerfileGenerateResult =
  | {
      ok: true;
      kind: string;
      dockerfile: string;
      dockerignore: string;
      empty: boolean;
      published: false;
      imageTag: null;
      status: "ready_zip";
      hint: string;
    }
  | { ok: false; error: string; conflict?: true };

/** Write Dockerfile + .dockerignore into a project root. Not a publish. */
export async function generateWorkspaceDockerfile(
  root: string,
  overwrite = false,
): Promise<DockerfileGenerateResult> {
  let files: FileEntry[];
  try {
    files = (await listWorkspaceTree(root)).entries;
  } catch {
    return { ok: false, error: "Не удалось прочитать файлы воркспейса" };
  }

  const profile = detectDockerfileProfile(root, readPackageJson(root), files);

  const existing = await readWorkspaceFile(root, "Dockerfile").catch(() => null);
  if (existing !== null && !overwrite) {
    return {
      ok: false,
      error: "Dockerfile уже существует — подтвердите перезапись",
      conflict: true,
    };
  }

  await writeWorkspaceFile(root, "Dockerfile", profile.dockerfile);
  try {
    await writeWorkspaceFile(root, ".dockerignore", profile.dockerignore);
  } catch {
    // .dockerignore — best effort, Dockerfile already written.
  }

  return {
    ok: true,
    kind: profile.kind,
    dockerfile: profile.dockerfile,
    dockerignore: profile.dockerignore,
    empty: !hasBuildableAppFiles(files),
    published: false,
    imageTag: null,
    status: "ready_zip",
    hint: DOCKERFILE_NOT_PUBLISHED,
  };
}
