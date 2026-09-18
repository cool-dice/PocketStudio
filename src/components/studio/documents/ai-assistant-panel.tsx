"use client";

/**
 * Вкладка «ИИ-помощник»: WIP-баннер, сетка будущих действий с метками
 * «скоро» и мини-история правок. Всё — визуальный слой без логики.
 */

import {
  CornerDownRight,
  Maximize2,
  Minimize2,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { WipBanner } from "@/components/studio/shared/module-header";

const AI_ACTIONS: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: PenLine, label: "Переписать параграф", hint: "Переписать параграф — доступно на следующем этапе" },
  { icon: Maximize2, label: "Расширить", hint: "Расширить фрагмент — доступно на следующем этапе" },
  { icon: Minimize2, label: "Сократить", hint: "Сократить фрагмент — доступно на следующем этапе" },
  { icon: Search, label: "Найти факты", hint: "Найти факты — доступно на следующем этапе" },
  { icon: CornerDownRight, label: "Продолжить главу", hint: "Продолжить главу — доступно на следующем этапе" },
  { icon: Sparkles, label: "Улучшить стиль", hint: "Улучшить стиль — доступно на следующем этапе" },
];

const AI_HISTORY: { icon: LucideIcon; text: string; time: string }[] = [
  { icon: Minimize2, text: "Пролог сокращён на 18% — вода слита", time: "Сегодня, 12:41" },
  { icon: Sparkles, text: "Метафоры в главе 3 усилены", time: "Вчера" },
  { icon: Search, text: "Найдено 6 фактов для главы 5", time: "2 дня назад" },
];

export function AiAssistantPanel() {
  return (
    <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      <WipBanner
        title="ИИ-редактор подключается на следующем этапе"
        description="Слой интеллекта займётся вашим текстом прямо в редакторе — без переключения контекста."
        features={["правки по выделению", "проверка фактов", "стиль книги"]}
      />

      <section aria-label="Действия ИИ над текстом">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Действия с текстом
        </h4>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {AI_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.hint}
              className="group relative flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border bg-background px-2 text-center transition-all hover:border-primary/40 hover:bg-accent hover:shadow-xs active:scale-[0.98]"
            >
              <action.icon
                className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110"
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium leading-tight">{action.label}</span>
              <span
                className="absolute right-1.5 top-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[9px] font-medium leading-none text-amber-700 dark:text-amber-400"
                aria-hidden="true"
              >
                скоро
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="История правок">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">История правок</h4>
        <ul className="mt-2 space-y-1.5">
          {AI_HISTORY.map((item) => (
            <li
              key={item.text}
              className="flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2"
            >
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <item.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{item.text}</span>
                <span className="block text-[11px] text-muted-foreground">{item.time}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
          Правки применяются к выделенному фрагменту и остаются в истории документа.
        </p>
      </section>
    </div>
  );
}
