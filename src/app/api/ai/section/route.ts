import { NextResponse } from "next/server";
import { z } from "zod";

import { aiChatText, aiErrorResponse } from "@/lib/ai";
import { sectionSystemFor } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { snapshotSection } from "@/lib/section-revisions";
import { ensureOwned } from "@/lib/workspace-api";
import { sectionDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.object({
  sectionId: z.string().trim().min(1),
  action: z.enum(["write", "rewrite", "continue", "custom"]),
  instruction: z.string().trim().max(2_000).optional(),
});

function buildUserPrompt(opts: {
  title: string;
  content: string;
  action: "write" | "rewrite" | "continue" | "custom";
  instruction?: string;
}): string {
  const body = opts.content.trim() || "(глава пока пустая — напиши её с нуля)";
  const parts = [`Глава: ${opts.title}`, "", body];
  if (opts.action === "custom" && opts.instruction) {
    parts.push("", `Инструкция автора: ${opts.instruction}`);
  }
  return parts.join("\n");
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const { sectionId, action, instruction } = parsed.data;
  if (action === "custom" && !instruction) {
    return NextResponse.json(
      { error: "Для своей правки напишите, что изменить" },
      { status: 400 },
    );
  }

  const section = await db.documentSection.findUnique({
    where: { id: sectionId },
    include: { document: { select: { id: true, projectId: true } } },
  });
  if (!section) {
    return NextResponse.json({ error: "Глава не найдена" }, { status: 404 });
  }
  const check = await ensureOwned(req, section.document);
  if (!check.ok) return check.response;

  const system = sectionSystemFor(action, !section.content.trim());

  try {
    const generated = (
      await aiChatText(
        check.userId,
        "rewrite_section",
        system,
        buildUserPrompt({
          title: section.title,
          content: section.content,
          action,
          instruction,
        }),
      )
    ).trim();

    if (!generated) {
      return NextResponse.json(
        { error: "Модель вернула пустой текст — попробуйте ещё раз" },
        { status: 502 },
      );
    }

    const nextContent =
      action === "continue"
        ? [section.content.trim(), generated].filter(Boolean).join("\n\n")
        : generated;

    if (nextContent !== section.content) {
      try {
        await snapshotSection(section.id, section.content, "ai", { force: true });
      } catch (err) {
        console.error(
          "[ai/section] snapshot failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    const [updated] = await db.$transaction([
      db.documentSection.update({
        where: { id: section.id },
        data: { content: nextContent },
      }),
      db.document.update({
        where: { id: section.document.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ section: sectionDto(updated) });
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Не удалось переписать главу — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/section] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
