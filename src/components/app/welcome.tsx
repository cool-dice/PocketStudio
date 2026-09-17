"use client";

/**
 * Welcome — empty-thread screen: greeting + starter chips.
 * «Записать мысль» opens the ⌘K capture, «Создать проект» the project
 * creation dialog (template / GitHub / zip), «Что ты умеешь?» sends that
 * text to the agent.
 */

import { FolderGit2, NotebookPen, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useThreads } from "@/hooks/use-threads";
import { useAppUi } from "@/lib/store";

export function Welcome() {
  const { user } = useAuth();
  const { sendMessage } = useThreads();
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const openCreateProject = useAppUi((s) => s.openCreateProject);

  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || "друг";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <LogoMark className="size-12 rounded-xl" />
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Привет, {firstName}!
        </h2>
        <p className="mx-auto max-w-md text-muted-foreground text-balance">
          Расскажите, о чём думаете, — я превращу мысли в заметки, планы
          и приложения.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl"
          onClick={() => setCaptureOpen(true)}
        >
          <NotebookPen className="size-4" aria-hidden="true" />
          Записать мысль
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl"
          onClick={() => openCreateProject()}
        >
          <FolderGit2 className="size-4" aria-hidden="true" />
          Создать проект
          <span className="text-[11px] font-normal text-muted-foreground">
            из шаблона, GitHub или zip
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => void sendMessage("Что ты умеешь?")}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Что ты умеешь?
        </Button>
      </div>
    </div>
  );
}
