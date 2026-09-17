"use client";

/**
 * Welcome — empty-thread screen: greeting + starter chips.
 * Only «Что ты умеешь?» is enabled (sends that text); the rest are
 * placeholders with a «Скоро» tooltip.
 */

import { FolderGit2, NotebookPen, Sparkles } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useThreads } from "@/hooks/use-threads";
import { useAppUi } from "@/lib/store";

export function Welcome() {
  const { user } = useAuth();
  const { sendMessage } = useThreads();
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <FolderGit2 className="size-4" aria-hidden="true" />
              Создать проект
            </Button>
          </TooltipTrigger>
          <TooltipContent>Скоро</TooltipContent>
        </Tooltip>
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
