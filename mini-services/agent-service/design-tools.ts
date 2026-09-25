/**
 * Инструменты оркестратора для модуля Дизайн (фаза B):
 * open_in_design — подготовить растр из картинки воркспейса;
 * apply_filter — поставить фильтр в очередь холста (применится в редакторе).
 */

import { db } from "./db-client";
import {
  emptyRaster,
  parseDesignPayload,
  type RasterDoc,
} from "../../src/lib/design-model";
import type { ToolContext, ToolDef } from "./tools";
import { pickString, resolveWorkspace as resolveWorkspaceShared } from "../../src/lib/resolve-workspace";

async function resolveWorkspace(
  userId: string,
  args: Record<string, unknown>,
  ctx?: ToolContext,
) {
  const result = await resolveWorkspaceShared(db, userId, args, ctx, {
    required: true,
  });
  if (!result || "error" in result) {
    return {
      error:
        result && "error" in result
          ? result.error
          : "Укажите воркспейс: откройте чат внутри воркспейса или передайте workspaceId",
    } as const;
  }
  return result;
}

async function loadRaster(projectId: string): Promise<{ id: string; doc: RasterDoc }> {
  let row = await db.designDoc.findFirst({
    where: { projectId, mode: "raster" },
  });
  if (!row) {
    const payload = emptyRaster();
    row = await db.designDoc.create({
      data: {
        projectId,
        mode: "raster",
        title: "Холст",
        payload: JSON.stringify(payload),
      },
    });
  }
  const parsed = parseDesignPayload(row.payload, "raster");
  const doc = parsed.kind === "raster" ? parsed : emptyRaster();
  return { id: row.id, doc };
}

const FILTERS = new Set(["bright", "contrast", "sat", "bw"]);

export const openInDesign: ToolDef = {
  name: "open_in_design",
  description:
    "Открыть изображение воркспейса в растровом редакторе Дизайна (подготовить холст).",
  argsSchema: {
    workspaceId: "id воркспейса (необязательно, если чат внутри воркспейса)",
    artifactId: "id картинки (необязательно — берётся последняя)",
  },
  async execute(args: Record<string, unknown>, userId: string, ctx: ToolContext) {
    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };
    const wantId = pickString(args, ["artifactId"]);
    const artifact = wantId
      ? await db.artifact.findFirst({
          where: { id: wantId, projectId: ws.id },
        })
      : await db.artifact.findFirst({
          where: {
            projectId: ws.id,
            type: { in: ["image", "portrait"] },
          },
          orderBy: { createdAt: "desc" },
        });
    const { id, doc } = await loadRaster(ws.id);
    const next: RasterDoc = {
      ...doc,
      layers: doc.layers.map((layer, i) =>
        i === 0
          ? { ...layer, dataUrl: artifact?.url ?? layer.dataUrl }
          : layer,
      ),
    };
    await db.designDoc.update({
      where: { id },
      data: {
        payload: JSON.stringify(next),
        previewUrl: artifact?.url ?? null,
      },
    });
    return {
      ok: true,
      workspaceId: ws.id,
      mode: "raster",
      imageUrl: artifact?.url ?? null,
      message:
        "Холст готов. Откройте вкладку «Дизайн → Растр» в этом воркспейсе.",
    };
  },
};

export const applyFilter: ToolDef = {
  name: "apply_filter",
  description:
    "Применить фильтр к растровому холсту воркспейса: bright, contrast, sat, bw.",
  argsSchema: {
    workspaceId: "id воркспейса (необязательно)",
    filter: "bright|contrast|sat|bw",
  },
  async execute(args: Record<string, unknown>, userId: string, ctx: ToolContext) {
    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };
    const filter = pickString(args, ["filter", "kind"]) ?? "bright";
    if (!FILTERS.has(filter)) {
      return { error: "Фильтр: bright, contrast, sat или bw" };
    }
    const { id, doc } = await loadRaster(ws.id);
    const next: RasterDoc = {
      ...doc,
      pendingFilters: [
        ...(doc.pendingFilters ?? []),
        filter as "bright" | "contrast" | "sat" | "bw",
      ],
    };
    await db.designDoc.update({
      where: { id },
      data: { payload: JSON.stringify(next) },
    });
    return {
      ok: true,
      workspaceId: ws.id,
      filter,
      message: `Фильтр «${filter}» поставлен в очередь холста. Откройте Дизайн → Растр.`,
    };
  },
};

export const DESIGN_TOOLS: ToolDef[] = [openInDesign, applyFilter];
