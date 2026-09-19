import { NextResponse } from "next/server";
import { z } from "zod";

import { aiChatJson, aiErrorResponse } from "@/lib/ai";
import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { documentDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/* ── POST /api/ai/monetize — LLM-план монетизации воркспейса ──
 * Бриф = имя+тип+описание+стадия воркспейса + краткий бриф пользователя.
 * План сохраняется как Document kind="spec" с 5 секциями; прежний план
 * (title начинается с «План монетизации») удаляется и пересобирается. */

const schema = z.object({
  projectId: z.string().trim().min(1),
  brief: z.string().trim().max(2_000).optional(),
});

const TYPE_LABELS: Record<string, string> = {
  film: "фильм/видео",
  book: "книга",
  music: "музыка",
  app: "приложение",
  universal: "универсальный проект",
};

interface PlanProduct {
  name: string;
  price: string;
  note: string;
}
interface PlanChannel {
  name: string;
  note: string;
}
interface PlanStep {
  term: string;
  note: string;
}
interface MonetizePlan {
  concept: string;
  products: PlanProduct[];
  channels: PlanChannel[];
  steps: PlanStep[];
  forecast: {
    assumption: string;
    monthly: { label: string; amount: number }[];
  };
}

const MONETIZE_SYSTEM = `Ты — продюсер карманной творческой студии. Тебе дают воркспейс (тип, название, описание, стадия, что уже готово) и, возможно, бриф пользователя.
Составь реалистичный, конкретный план монетизации этого творческого проекта на русском языке.
Продукты и цены — правдоподобные для российского рынка (рубли, «490 ₽», «1 990 ₽», «9 $» для зарубежных площадок). Никакой воды: каждый пункт — конкретное действие или оффер.
Отвечай СТРОГО одним JSON-объектом (без markdown, без пояснений вокруг) точно такой структуры:
{
  "concept": "1-2 предложения о том, как проект зарабатывает",
  "products": [{"name": "название продукта", "price": "цена строкой", "note": "короткое пояснение (1 предложение)"}],
  "channels": [{"name": "название канала/площадки", "note": "что там делать"}],
  "steps": [{"term": "Неделя 1-2", "note": "конкретное действие"}],
  "forecast": {"assumption": "допущение прогноза (1 предложение)", "monthly": [{"label": "Месяц 1", "amount": 15000}]}
}
Требования: products — ровно 4-5 штук; channels — 3-4; steps — 4-6 с нарастающими сроками (Неделя 1-2, Неделя 3-4, Месяц 2, Месяц 3); forecast.monthly — ровно 3 точки (Месяц 1, Месяц 2, Месяц 3), amount — число в рублях.`;

/** Строковое поле с защитой от мусора LLM. */
function str(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Число (суммы могут прийти строкой). */
function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return 0;
}

/** Мягкая нормализация ответа модели: чистим, фильтруем пустое, режем лимиты. */
function normalizePlan(raw: unknown): MonetizePlan | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const products = (Array.isArray(r.products) ? r.products : [])
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      name: str(p.name, 120),
      price: str(p.price, 40),
      note: str(p.note, 400),
    }))
    .filter((p) => p.name.length > 0)
    .slice(0, 5);

  const channels = (Array.isArray(r.channels) ? r.channels : [])
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({ name: str(c.name, 120), note: str(c.note, 400) }))
    .filter((c) => c.name.length > 0)
    .slice(0, 4);

  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({ term: str(s.term, 60), note: str(s.note, 400) }))
    .filter((s) => s.note.length > 0)
    .slice(0, 6);

  const forecastRaw =
    typeof r.forecast === "object" && r.forecast !== null
      ? (r.forecast as Record<string, unknown>)
      : {};
  const monthly = (Array.isArray(forecastRaw.monthly) ? forecastRaw.monthly : [])
    .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
    .map((m) => ({ label: str(m.label, 40) || "Месяц", amount: num(m.amount) }))
    .slice(0, 3);

  const concept = str(r.concept, 600);
  if (!concept || products.length === 0) return null;

  return {
    concept,
    products,
    channels,
    steps,
    forecast: {
      assumption: str(forecastRaw.assumption, 400),
      monthly:
        monthly.length > 0
          ? monthly
          : [
              { label: "Месяц 1", amount: 0 },
              { label: "Месяц 2", amount: 0 },
              { label: "Месяц 3", amount: 0 },
            ],
    },
  };
}

/** Человекочитаемый текст секции поверх JSON-маркера. */
function humanBlock(lines: string[]): string {
  return lines.filter((l) => l.trim().length > 0).join("\n");
}

const ruble = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const { projectId, brief } = parsed.data;

  const check = await ensureWorkspace(req, projectId);
  if (!check.ok) return check.response;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: check.userId },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }

  /* Контекст для LLM: что уже есть в воркспейсе (честный бриф). */
  const [artifacts, entities, documents] = await Promise.all([
    db.artifact.findMany({ where: { projectId }, select: { type: true } }),
    db.entity.count({ where: { projectId } }),
    db.document.count({ where: { projectId } }),
  ]);
  const byType = artifacts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  const inventory = [
    `документов: ${documents}`,
    `сущностей: ${entities}`,
    `изображений: ${byType.image ?? 0}`,
    `аудио: ${byType.audio ?? 0}`,
    `видео: ${byType.video ?? 0}`,
  ].join(", ");

  const userPrompt = [
    `Тип проекта: ${TYPE_LABELS[project.type] ?? project.type}`,
    `Название: ${project.name}`,
    `Описание: ${project.description?.trim() || "(без описания)"}`,
    `Стадия: ${project.stage ?? "старт"} (прогресс ${project.progress}%)`,
    `Уже создано в студии: ${inventory}.`,
    brief
      ? `Бриф пользователя: ${brief}`
      : "Бриф пользователя: (нет — предложи сам).",
  ].join("\n");

  let plan: MonetizePlan;
  try {
    const normalized = normalizePlan(
      await aiChatJson(check.userId, "monetize", MONETIZE_SYSTEM, userPrompt),
    );
    if (!normalized) {
      throw new Error("Пустой или неструктурированный ответ модели");
    }
    plan = normalized;
  } catch (err) {
    const mapped = aiErrorResponse(
      err,
      "Модель не собрала план — попробуйте ещё раз",
    );
    if (mapped.status >= 500) {
      console.error("[ai/monetize] failed:", err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    /* Регенерация = замена: прежний план-документ удаляем (секции каскадом). */
    const previous = await db.document.findFirst({
      where: { projectId, kind: "spec", title: { startsWith: "План монетизации" } },
      select: { id: true },
    });
    if (previous) {
      await db.document.delete({ where: { id: previous.id } });
    }

    const sectionProducts = humanBlock([
      "ПРОДУКТЫ_JSON:" + JSON.stringify(plan.products),
      "",
      ...plan.products.map(
        (p, i) => `${i + 1}. «${p.name}» — ${p.price}${p.note ? `\n   ${p.note}` : ""}`,
      ),
    ]);
    const sectionChannels = humanBlock([
      "КАНАЛЫ_JSON:" + JSON.stringify(plan.channels),
      "",
      ...plan.channels.map((c) => `• ${c.name}${c.note ? ` — ${c.note}` : ""}`),
    ]);
    const sectionSteps = humanBlock([
      "ШАГИ_JSON:" + JSON.stringify(plan.steps),
      "",
      ...plan.steps.map((s) => `${s.term} — ${s.note}`),
    ]);
    const sectionForecast = humanBlock([
      "ПРОГНОЗ_JSON:" + JSON.stringify(plan.forecast),
      "",
      plan.forecast.assumption ? `Допущение: ${plan.forecast.assumption}` : "",
      "",
      ...plan.forecast.monthly.map((m) => `${m.label}: ${ruble(m.amount)}`),
    ]);

    const created = await db.document.create({
      data: {
        projectId,
        kind: "spec",
        title: `План монетизации · ${new Date().toLocaleDateString("ru-RU")}`,
        description: brief ? `Бриф: ${brief}` : "Собран студией по данным воркспейса",
        sections: {
          create: [
            { title: "Концепция", order: 0, status: "done", content: plan.concept },
            {
              title: "Продукты и цены",
              order: 1,
              status: "done",
              content: sectionProducts,
            },
            { title: "Каналы", order: 2, status: "done", content: sectionChannels },
            { title: "План запуска", order: 3, status: "done", content: sectionSteps },
            { title: "Прогноз", order: 4, status: "done", content: sectionForecast },
          ],
        },
      },
      include: { sections: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json({ document: documentDto(created), plan }, { status: 201 });
  } catch (err) {
    console.error(
      "[ai/monetize] save failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "План собран, но не сохранился — попробуйте ещё раз" },
      { status: 500 },
    );
  }
}
