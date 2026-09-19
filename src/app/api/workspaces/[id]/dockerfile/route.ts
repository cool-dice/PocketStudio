import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  projectRoot,
  readWorkspaceFile,
  writeWorkspaceFile,
  listWorkspaceTree,
  type FileEntry,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/[id]/dockerfile — генератор Dockerfile (Фаза D).
 *
 * Анализирует реальные файлы воркспейса (package.json, фреймворк-маркеры)
 * и пишет Dockerfile + .dockerignore в корень проекта на диск. Сборка
 * образа в песочнице недоступна (docker CLI отсутствует) — поэтому
 * генератор возвращает содержимое и сохраняет файлы, а не запускает build.
 */

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

/** Определить рантайм-профиль проекта по файлам. */
function detectProfile(
  root: string,
  pkg: PackageJson | null,
  files: FileEntry[],
): { kind: string; dockerfile: string; dockerignore: string } {
  const has = (p: string) => files.some((f) => f.path === p);

  // Node-проект с package.json: Next / Vite / прочий Node.
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

  // Python-проект.
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

  // Статика (index.html).
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

  // Универсальный контейнер.
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

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = bodySchema.safeParse(await req.json().catch(() => ({})));

  const project = await db.project.findFirst({
    where: { id, userId: session.sub },
    select: { id: true, name: true, rootPath: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }
  if (!project.rootPath) {
    return NextResponse.json(
      {
        error:
          "У контентного воркспейса нет файлов на диске — Dockerfile генерируется для воркспейсов с кодом",
      },
      { status: 400 },
    );
  }

  const root = projectRoot(project.id);
  let files: FileEntry[];
  try {
    const tree = await listWorkspaceTree(root);
    files = tree.entries;
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать файлы воркспейса" },
      { status: 400 },
    );
  }

  const profile = detectProfile(root, readPackageJson(root), files);

  // Уже сгенерирован? Без overwrite — не трогаем.
  const existing = await readWorkspaceFile(root, "Dockerfile").catch(
    () => null,
  );
  if (existing !== null && !body.data?.overwrite) {
    return NextResponse.json(
      { error: "Dockerfile уже существует — подтвердите перезапись" },
      { status: 409 },
    );
  }

  await writeWorkspaceFile(root, "Dockerfile", profile.dockerfile);
  try {
    await writeWorkspaceFile(root, ".dockerignore", profile.dockerignore);
  } catch {
    // .dockerignore — best effort, Dockerfile уже записан.
  }

  return NextResponse.json({
    kind: profile.kind,
    dockerfile: profile.dockerfile,
    dockerignore: profile.dockerignore,
    workspace: { id: project.id, name: project.name },
  });
}
