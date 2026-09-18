"use client";

/**
 * CreateWorkspaceDialog — мастер создания воркспейса (Фаза A):
 * тип → название → превью с пайплайном → api.createWorkspace(БД).
 * Успех: тост + тихое обновление списка + открытие Обзора нового
 * воркспейса. Ошибка — тост с сообщением сервера.
 * Содержимое шагов — в create-workspace-steps.tsx.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { invalidateWorkspaces } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import type { WorkspaceType } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  StepName,
  StepPreview,
  StepType,
} from "@/components/workspaces/create-workspace-steps";

const STEPS = [
  { id: 1, label: "Тип" },
  { id: 2, label: "Название" },
  { id: 3, label: "Готово" },
] as const;

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<WorkspaceType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  /**
   * Любое закрытие (крестик, Escape, «Создать») возвращает мастер
   * к первому шагу — каждый запуск начинается с чистого листа.
   */
  function handleOpenChange(next: boolean) {
    if (!next) {
      setStep(1);
      setType(null);
      setName("");
      setDescription("");
    }
    onOpenChange(next);
  }

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const canGoNext =
    step === 1 ? type !== null : step === 2 ? trimmedName.length > 0 : true;

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function goNext() {
    setStep((s) => Math.min(3, s + 1));
  }

  /** Создание в БД: тост → тихое обновление списка → Обзор нового id. */
  async function handleCreate() {
    if (!type || trimmedName.length === 0 || creating) return;
    setCreating(true);
    try {
      const created = await api.createWorkspace({
        type,
        name: trimmedName,
        description: trimmedDescription || undefined,
      });
      invalidateWorkspaces();
      handleOpenChange(false);
      useAppUi.getState().openWorkspace(created.id, "overview");
      toast.success("Воркспейс создан", {
        description: `«${created.name}» уже в списке — оркестратор предложит план на вкладке «Обзор».`,
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось создать воркспейс",
        { description: "Проверьте соединение и попробуйте ещё раз." },
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" aria-hidden="true" />
            Новый воркспейс
          </DialogTitle>
          <DialogDescription>
            Тип, название — и оркестратор сразу предложит план конвейера.
          </DialogDescription>
        </DialogHeader>

        {/* ── Шаги мастера ── */}
        <div className="border-b px-6 py-3">
          <ol
            className="flex items-center gap-1.5"
            aria-label={`Шаг ${step} из 3: ${STEPS[step - 1].label}`}
          >
            {STEPS.map((s, i) => {
              const done = step > s.id;
              const current = step === s.id;
              return (
                <li key={s.id} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 ? (
                    <span aria-hidden="true" className="h-px w-4 bg-border sm:w-6" />
                  ) : null}
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      current && "border-primary/50 bg-primary/10 text-primary",
                      done && "border-primary/40 bg-primary/5 text-primary/80",
                      !current && !done && "border-border text-muted-foreground",
                    )}
                    aria-current={current ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
                        current
                          ? "bg-primary text-primary-foreground"
                          : done
                            ? "bg-primary/70 text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <Check className="size-2.5" aria-hidden="true" />
                      ) : (
                        s.id
                      )}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                </li>
              );
            })}
            <li
              className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              Шаг {step} из 3
            </li>
          </ol>
        </div>

        {/* ── Контент шага ── */}
        <div className="vf-scroll max-h-[52dvh] overflow-y-auto px-6 py-4">
          {step === 1 ? (
            <StepType selected={type} onSelect={setType} />
          ) : null}
          {step === 2 && type ? (
            <StepName
              type={type}
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
              onEditType={() => setStep(1)}
              onSubmit={canGoNext ? goNext : undefined}
            />
          ) : null}
          {step === 3 && type ? (
            <StepPreview
              type={type}
              name={trimmedName}
              description={trimmedDescription}
            />
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 1}
          >
            <ArrowLeft aria-hidden="true" />
            Назад
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={goNext} disabled={!canGoNext}>
              Далее
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {creating ? "Создаём…" : "Создать воркспейс"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
