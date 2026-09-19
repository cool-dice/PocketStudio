"use client";

/**
 * Вкладка «ИИ-помощник»: честная заглушка до волны документов (W4).
 * Нет кнопок, которые выглядят рабочими.
 */

import { Sparkles } from "lucide-react";

export function AiAssistantPanel() {
  return (
    <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="rounded-xl border bg-card p-4">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Sparkles className="size-4" />
        </span>
        <h4 className="mt-3 text-sm font-semibold">ИИ-правка главы — следующая волна</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Текст слева уже автосохраняется и хранит версии. Переписать или
          продолжить главу из этой панели появится вместе с вызовом шлюза.
          Сейчас то же действие можно попросить у оркестратора во вкладке «Чат».
        </p>
      </div>
    </div>
  );
}
