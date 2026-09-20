import { readJsonBody } from "@/lib/json-body-limit";
// PATCH /api/notifications/[id] — mark a single notification read/unread.
// Body: { read?: boolean } (default true). → { notification }
//
// Ownership-scoped: a foreign id 404s ("Уведомление не найдено").

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  read: z.boolean().optional().default(true),
});

function serialize(n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  dedupeKey?: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityId: n.entityId,
    dedupeKey: n.dedupeKey ?? null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;

  const jsonRead = await readJsonBody(req, { fallback: null });
  if (!jsonRead.ok) return jsonRead.response;
  const body: unknown = jsonRead.value;
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некорректный запрос" },
      { status: 400 },
    );
  }

  const existing = await db.notification.findFirst({
    where: { id, userId: session.sub },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Уведомление не найдено" },
      { status: 404 },
    );
  }

  const updated = await db.notification.update({
    where: { id: existing.id },
    data: { read: parsed.data.read },
  });

  return NextResponse.json({ notification: serialize(updated) });
}
