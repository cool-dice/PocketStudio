import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { retrieve } from "@/lib/rag";
import { resolveRetrieveScope } from "@/lib/rag/scope";
import { RAG_SOURCE_TYPES } from "@/lib/rag/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  query: z.string().trim().min(1, "Запрос обязателен").max(2000),
  projectId: z.string().trim().min(1).nullable().optional(),
  kinds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(12).optional(),
  /** Thread scope: pass the open chat's projectId (null = main/global). */
  threadProjectId: z.string().trim().min(1).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const threadProjectId = parsed.data.threadProjectId ?? null;
  if (threadProjectId) {
    const owned = await db.project.findFirst({
      where: { id: threadProjectId, userId: session.sub },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
    }
  }

  let requested = parsed.data.projectId ?? null;
  if (requested) {
    const owned = await db.project.findFirst({
      where: { id: requested, userId: session.sub },
      select: { id: true },
    });
    if (!owned) requested = null;
  }

  const scope = resolveRetrieveScope({
    userId: session.sub,
    threadProjectId,
    requestedProjectId: threadProjectId ? null : requested,
  });

  const kinds = (parsed.data.kinds ?? []).filter((k) =>
    (RAG_SOURCE_TYPES as readonly string[]).includes(k),
  );

  const result = await retrieve(db, {
    scope,
    query: parsed.data.query,
    kinds: kinds.length ? kinds : undefined,
    limit: parsed.data.limit,
  });

  return NextResponse.json(result);
}
