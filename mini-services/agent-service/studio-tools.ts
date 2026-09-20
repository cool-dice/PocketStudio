/**
 * Typed studio tools: create_workspace (ask+act) and list_workspaces.
 * create_project stays in tools.ts for Next.js template apps only.
 */

import { createTypedWorkspace, validateWorkspaceCreate } from "../../src/lib/create-typed-workspace";
import { db } from "./db-client";
import type { ToolContext, ToolDef } from "./tools";

const createWorkspace: ToolDef = {
  name: "create_workspace",
  description:
    "Создать творческий воркспейс (фильм/книга/музыка/приложение/универсальный), не Next.js-шаблон. В главном чате привязывает диалог. Если диалог уже в студии — создаёт новую, не перепривязывает. Доступен в «Спросить» и «Действовать».",
  argsSchema: {
    name: "название воркспейса (обязательно, 1–80 символов)",
    type: "film|book|music|app|universal или фильм/книга/музыка/песня/трек/приложение/универсальный",
    description: "описание (необязательно, до 500 символов)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const parsed = validateWorkspaceCreate({
      name: args.name,
      type: args.type,
      description: args.description,
    });
    if ("error" in parsed) return { error: parsed.error };

    const project = await createTypedWorkspace(db, userId, parsed);

    let bound = false;
    const thread = await db.thread.findUnique({ where: { id: ctx.threadId } });
    if (thread && thread.userId === userId && thread.projectId === null) {
      await db.thread.update({
        where: { id: thread.id },
        data: { projectId: project.id },
      });
      bound = true;
    }

    return {
      message: bound
        ? `Воркспейс создан и привязан к диалогу: ${project.name}`
        : `Воркспейс создан: ${project.name}`,
      bound,
      workspaceId: project.id,
      workspace: {
        id: project.id,
        name: project.name,
        type: project.type,
        origin: project.origin,
        stage: project.stage,
      },
    };
  },
};

const listWorkspaces: ToolDef = {
  name: "list_workspaces",
  description:
    "Студии пользователя (origin=workspace): id, название, тип, стадия. Чтобы выбрать существующую песню/книгу/фильм, а не шаблон Next.js.",
  argsSchema: {},
  async execute(_args: any, userId: string, _ctx: ToolContext) {
    const rows = await db.project.findMany({
      where: { userId, origin: "workspace", archived: false },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, name: true, type: true, stage: true, updatedAt: true },
    });
    return {
      workspaces: rows.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        stage: p.stage,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  },
};

export const STUDIO_TOOLS: ToolDef[] = [createWorkspace, listWorkspaces];
