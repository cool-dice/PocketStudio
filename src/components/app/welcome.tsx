"use client";

/**
 * Welcome — empty-thread screen: greeting + starter chips.
 * «Записать мысль» opens the ⌘K capture, «Создать проект» the project
 * creation dialog (template / GitHub / zip), «Что ты умеешь?» sends that
 * text to the agent. Below the chips: a subtle kbd-hint row (Ctrl+K capture,
 * Ctrl+P search, / commands) so the shortcuts are discoverable.
 */

import { motion } from "framer-motion";
import { AudioWaveform, BookOpenText, Clapperboard, FolderGit2, NotebookPen, Sparkles } from "lucide-react";

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
  const openWorkspace = useAppUi((s) => s.openWorkspace);

  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || "друг";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <LogoMark className="size-12 rounded-xl shadow-sm ring-1 ring-primary/10" />
      </motion.div>
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          Привет, {firstName}!
        </h2>
        <p className="mx-auto max-w-md text-muted-foreground text-balance">
          Карманная студия в одном диалоге: мысль превращается в текст,
          картинку, трек, фильм и работающий продукт.
        </p>
      </motion.div>
      <motion.div
        className="flex flex-wrap items-center justify-center gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
      >
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => setCaptureOpen(true)}
        >
          <NotebookPen className="size-4" aria-hidden="true" />
          Записать мысль
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => openWorkspace("ws-book-fjord", "documents")}
        >
          <BookOpenText className="size-4" aria-hidden="true" />
          Писать книгу
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => openWorkspace("ws-music-moon", "audio")}
        >
          <AudioWaveform className="size-4" aria-hidden="true" />
          Собрать трек
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => openWorkspace("ws-film-dwinter", "video")}
        >
          <Clapperboard className="size-4" aria-hidden="true" />
          Снять видео
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => openCreateProject()}
        >
          <FolderGit2 className="size-4" aria-hidden="true" />
          Создать проект
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl border-primary/40 bg-primary/5 text-primary transition-transform duration-150 hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary"
          onClick={() => void sendMessage("Что ты умеешь?")}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Что ты умеешь?
        </Button>
      </motion.div>
      <motion.p
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
          мысль
        </span>
        <span aria-hidden="true" className="opacity-40">
          ·
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Ctrl P
          </kbd>
          поиск
        </span>
        <span aria-hidden="true" className="opacity-40">
          ·
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            /
          </kbd>
          команды
        </span>
      </motion.p>
    </div>
  );
}
