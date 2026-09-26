"use client";

/**
 * Вкладка «ИИ-помощник»: реальная правка главы через шлюз (`/api/ai/section`).
 * Переписать / продолжить / своя инструкция → текст в редакторе + ревизия.
 */

import { useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { sectionAiAction } from "@/lib/ai/prompts";
import { SECTION_AI_FAILED, SECTION_AI_UNCONFIGURED_HINT } from "@/lib/studio-copy";
import type { DocumentSectionDto } from "@/lib/workspace-types";

export function AiAssistantPanel({
  section,
  draft,
  onBeforeGenerate,
  onApplied,
}: {
  section: DocumentSectionDto | null;
  draft: string;
  /** Сбросить несохранённый драфт в БД до вызова ИИ. */
  onBeforeGenerate: () => Promise<unknown>;
  onApplied: (section: DocumentSectionDto) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"write" | "rewrite" | "continue" | "custom" | null>(
    null,
  );

  async function run(action: "write" | "rewrite" | "continue" | "custom") {
    if (!section || busy) return;
    if (action === "custom" && instruction.trim().length < 3) {
      toast.error("Напишите, что изменить в главе");
      return;
    }
    setBusy(action);
    try {
      await onBeforeGenerate();
      const updated = await api.aiRewriteSection({
        sectionId: section.id,
        action,
        instruction:
          action === "custom" ? instruction.trim() : undefined,
      });
      onApplied(updated);
      toast.success(
        action === "continue"
          ? "Глава продолжена"
          : action === "custom"
            ? "Глава переписана по инструкции"
            : action === "write"
              ? "Глава написана"
              : "Глава переписана",
        { description: "Старый текст сохранён в истории версий." },
      );
    } catch (err) {
      const unconfigured =
        err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
      toast.error(
        unconfigured ? UNCONFIGURED_TOOL_MESSAGE : SECTION_AI_FAILED,
        {
          description: unconfigured ? SECTION_AI_UNCONFIGURED_HINT : undefined,
        },
      );
    } finally {
      setBusy(null);
    }
  }

  if (!section) {
    return (
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Выберите главу слева — помощник перепишет или продолжит её текст.
        </p>
      </div>
    );
  }

  const empty = draft.trim().length === 0;
  const disabled = Boolean(busy);

  return (
    <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="rounded-xl border bg-card p-4">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Sparkles className="size-4" />
        </span>
        <h4 className="mt-3 text-sm font-semibold">ИИ-правка главы</h4>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {empty
            ? `«${section.title}» пока пустая — студия напишет черновик.`
            : `Работаем с «${section.title}». Старый текст останется в истории версий.`}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => void run(sectionAiAction(draft))}
          >
            {busy === "rewrite" || busy === "write" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Wand2 className="size-4" aria-hidden="true" />
            )}
            {empty ? "Написать главу" : "Переписать главу"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || empty}
            onClick={() => void run("continue")}
          >
            {busy === "continue" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Продолжить текст
          </Button>
        </div>

        <label htmlFor="ai-section-instruction" className="mt-4 block text-xs font-medium text-muted-foreground">
          Своя инструкция
        </label>
        <Textarea
          id="ai-section-instruction"
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={disabled}
          placeholder="Например: короче, от лица Марины, без метафор…"
          className="mt-1.5 resize-none"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          disabled={disabled || instruction.trim().length < 3}
          onClick={() => void run("custom")}
        >
          {busy === "custom" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          Применить инструкцию
        </Button>
      </div>
    </div>
  );
}
