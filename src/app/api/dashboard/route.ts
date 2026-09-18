import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import type { DashboardActivityItem, DashboardDto } from "@/lib/workspace-types";
import type { ArtifactType } from "@/lib/workspace-types";

export const dynamic = "force-dynamic";

/* ── GET /api/dashboard — живые счётчики + лента активности ── */

const ACTIVITY_TEXT: Partial<Record<ArtifactType, (title: string) => string>> = {
  image: (t) => `Изображение: ${t}`,
  portrait: (t) => `Портрет: ${t}`,
  track: (t) => `Трек: ${t}`,
  audio: (t) => `Аудио: ${t}`,
  scene: (t) => `Сцена: ${t}`,
  video: (t) => `Видео: ${t}`,
  document: (t) => `Документ: ${t}`,
  note: (t) => `Заметка: ${t}`,
  app: (t) => `Файл: ${t}`,
  deploy: (t) => `Деплой: ${t}`,
  file: (t) => `Файл: ${t}`,
};

/** «N мин назад» — грубая человекочитаемая разница. */
function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  return `${days} дня назад`;
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const workspaces = await db.project.findMany({
    where: { userId: session.sub, origin: "workspace" },
    select: { id: true },
  });
  const workspaceIds = workspaces.map((w) => w.id);

  const [artifactsCount, notesWeek, activeStages, recentArtifacts] =
    await Promise.all([
      db.artifact.count({ where: { projectId: { in: workspaceIds } } }),
      db.note.count({
        where: {
          userId: session.sub,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
        },
      }),
      db.project.count({
        where: {
          userId: session.sub,
          origin: "workspace",
          progress: { gt: 0, lt: 100 },
        },
      }),
      db.artifact.findMany({
        where: { projectId: { in: workspaceIds } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          projectId: true,
          type: true,
          title: true,
          createdAt: true,
        },
      }),
    ]);

  const activity: DashboardActivityItem[] = recentArtifacts.map((a) => ({
    id: a.id,
    workspaceId: a.projectId,
    text: (ACTIVITY_TEXT[a.type as ArtifactType] ?? ((t: string) => t))(a.title),
    time: timeAgo(a.createdAt),
    type: a.type as ArtifactType,
  }));

  const dto: DashboardDto = {
    stats: {
      workspaces: workspaceIds.length,
      artifacts: artifactsCount,
      notesWeek,
      activeStages,
    },
    activity,
  };

  return NextResponse.json(dto);
}
