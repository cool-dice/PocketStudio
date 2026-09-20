import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import {
  emptyLayout,
  emptyRaster,
  parseDesignPayload,
  tryParseDesignPayload,
} from "@/lib/design-model";
import { oversizedJsonResponse } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;
  const mode = new URL(req.url).searchParams.get("mode") === "layout" ? "layout" : "raster";
  let doc = await db.designDoc.findFirst({
    where: { projectId: id, mode },
    orderBy: { updatedAt: "desc" },
  });
  if (!doc) {
    const payload = mode === "layout" ? emptyLayout() : emptyRaster();
    doc = await db.designDoc.create({
      data: {
        projectId: id,
        mode,
        title: mode === "layout" ? "Макет" : "Холст",
        payload: JSON.stringify(payload),
      },
    });
  }
  return NextResponse.json({
    design: {
      id: doc.id,
      projectId: doc.projectId,
      title: doc.title,
      mode: doc.mode,
      payload: parseDesignPayload(doc.payload, mode),
      previewUrl: doc.previewUrl,
      updatedAt: doc.updatedAt.toISOString(),
    },
  });
}

const putSchema = z.object({
  mode: z.enum(["raster", "layout"]).optional(),
  title: z.string().trim().max(80).optional(),
  payload: z.unknown(),
  previewUrl: z.string().max(2_000_000).nullable().optional(),
});

export async function PUT(req: Request, { params }: Params) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;
  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const mode = parsed.data.mode ?? "raster";
  const normalized = tryParseDesignPayload(parsed.data.payload);
  if (!normalized) {
    return NextResponse.json(
      { error: "Некорректный документ дизайна — не сохраняю, чтобы не затереть холст" },
      { status: 400 },
    );
  }
  const existing = await db.designDoc.findFirst({
    where: { projectId: id, mode },
  });
  const payload = JSON.stringify(normalized);
  const doc = existing
    ? await db.designDoc.update({
        where: { id: existing.id },
        data: {
          payload,
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.previewUrl !== undefined
            ? { previewUrl: parsed.data.previewUrl }
            : {}),
        },
      })
    : await db.designDoc.create({
        data: {
          projectId: id,
          mode,
          title: parsed.data.title ?? (mode === "layout" ? "Макет" : "Холст"),
          payload,
          previewUrl: parsed.data.previewUrl ?? null,
        },
      });
  return NextResponse.json({
    design: {
      id: doc.id,
      projectId: doc.projectId,
      title: doc.title,
      mode: doc.mode,
      payload: parseDesignPayload(doc.payload, mode),
      previewUrl: doc.previewUrl,
      updatedAt: doc.updatedAt.toISOString(),
    },
  });
}
