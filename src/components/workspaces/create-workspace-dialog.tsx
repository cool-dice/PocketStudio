"use client";

/**
 * CreateWorkspaceDialog — мастер создания воркспейса (PS-3-a):
 * тип → название → превью с пайплайном. Созданный воркспейс открывается
 * в оболочке (PS-3-b) как override-объект — без похода в БД (Фаза A).
 * Содержимое шагов — в create-workspace-steps.tsx.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from "lucide-react";
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
import { useAppUi } from "@/lib/store";
import {
  WORKSPACE_STAGES,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
  type WorkspaceType,
} from "@/lib/workspace-data";
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

  function handleCreate() {
    if (!type || trimmedName.length === 0) return;
    const meta = WORKSPACE_TYPE_META[type];
    const stages = WORKSPACE_STAGES[type];
    const ws: WorkspaceSummary = {
      id: `ws-local-${Date.now()}`,
      type,
      title: trimmedName,
      subtitle: trimmedDescription || meta.hint,
      description: trimmedDescription || meta.hint,
      stage: stages[0],
      stageIndex: 1,
      progress: 0,
      updatedAgo: "только что",
      gradient: meta.gradient,
      counts: { notes: 0, documents: 0, images: 0, audio: 0, video: 0, files: 0 },
    };
    onOpenChange(false);
    useAppUi.getState().openWorkspaceData(ws, "overview");
    toast.success("Воркспейс создан", {
      description: "Оркестратор предложит план конвейера на вкладке «Обзор».",
    });
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
            <Button type="button" onClick={handleCreate}>
              <Sparkles aria-hidden="true" />
              Создать воркспейс
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
