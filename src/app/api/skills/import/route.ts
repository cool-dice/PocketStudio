import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { catalogByKey } from "@/lib/skills-catalog";
import { skillDto } from "@/lib/skill-shapes";
import {
  validateImportedSkillMd,
  validateSkillImportUrl,
} from "@/lib/skill-import";

export const dynamic = "force-dynamic";

const schema = z.object({
  catalogKey: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().max(2000).optional(),
  skillMd: z.string().max(20_000).optional(),
  name: z.string().trim().min(1).max(80).optional(),
});

function parseFrontmatter(md: string): {
  name?: string;
  triggers: string[];
  body: string;
} {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { triggers: [], body: md };
  const head = match[1];
  const body = match[2] ?? "";
  let name: string | undefined;
  let triggers: string[] = [];
  for (const line of head.split("\n")) {
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
    const trigMatch = line.match(/^triggers:\s*(\[.*\])\s*$/);
    if (trigMatch) {
      try {
        const parsed = JSON.parse(trigMatch[1]) as unknown;
        if (Array.isArray(parsed)) {
          triggers = parsed.filter((x): x is string => typeof x === "string");
        }
      } catch {
        // ignore
      }
    }
  }
  return { name, triggers, body: md };
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = schema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  if (parsed.data.catalogKey) {
    const item = catalogByKey(parsed.data.catalogKey);
    if (!item) {
      return NextResponse.json({ error: "Скилл магазина не найден" }, { status: 404 });
    }
    const existing = await db.skill.findFirst({
      where: { userId: session.sub, catalogKey: item.key },
    });
    if (existing) {
      const row = await db.skill.update({
        where: { id: existing.id },
        data: { purchased: true, enabled: true, source: item.source === "store" ? "store" : existing.source },
      });
      return NextResponse.json({ skill: skillDto(row) });
    }
    const row = await db.skill.create({
      data: {
        userId: session.sub,
        catalogKey: item.key,
        name: item.name,
        description: item.description,
        version: item.version,
        source: item.source === "store" ? "store" : "imported",
        skillMd: item.skillMd,
        triggers: JSON.stringify(item.triggers),
        icon: item.icon,
        enabled: true,
        purchased: true,
      },
    });
    return NextResponse.json({ skill: skillDto(row) }, { status: 201 });
  }

  let skillMd = parsed.data.skillMd ?? "";
  if (parsed.data.url) {
    const urlCheck = validateSkillImportUrl(parsed.data.url);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    try {
      const res = await fetch(urlCheck.url, {
        headers: { accept: "text/plain, text/markdown, */*" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Не удалось скачать SKILL.md (${res.status})` },
          { status: 400 },
        );
      }
      skillMd = await res.text();
    } catch {
      return NextResponse.json(
        { error: "Не удалось загрузить URL SKILL.md" },
        { status: 400 },
      );
    }
  }

  const mdCheck = validateImportedSkillMd(skillMd);
  if (!mdCheck.ok) {
    return NextResponse.json({ error: mdCheck.error }, { status: 400 });
  }
  skillMd = mdCheck.skillMd;

  const meta = parseFrontmatter(skillMd);
  const row = await db.skill.create({
    data: {
      userId: session.sub,
      name: parsed.data.name ?? meta.name ?? "Импортированный скилл",
      description: "",
      skillMd,
      triggers: JSON.stringify(meta.triggers),
      source: "imported",
      enabled: true,
      purchased: true,
    },
  });
  return NextResponse.json({ skill: skillDto(row) }, { status: 201 });
}
