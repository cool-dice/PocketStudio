"use client";

/**
 * SlashCommands — chat-first command palette inside the Composer (Stage 4).
 * Typing "/" as the first character opens a floating menu above the input:
 * mode switches (ask/plan/act/review), quick note capture, create project,
 * notebook, global search, checkpoint and zip export for the bound project.
 * ArrowUp/Down move the selection, Tab autocompletes, Enter executes,
 * Escape dismisses (regular Enter sends once dismissed).
 */

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CornerDownLeft,
  Download,
  FolderGit2,
  HelpCircle,
  ListChecks,
  NotebookPen,
  Search,
  StickyNote,
  Terminal,
  Zap,
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  LayoutDashboard,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ThreadMode } from "@/lib/types";

export interface SlashCommand {
  /** Command token without the leading slash. */
  name: string;
  /** Short label in the menu. */
  label: string;
  description: string;
  icon: typeof Zap;
  /** Execute immediately on Enter (mode switches, dialogs…). */
  run: () => void | Promise<void>;
}

export interface SlashCommandsProps {
  /** Menu visibility (parent decides: slash token + non-empty filter). */
  open: boolean;
  commands: SlashCommand[];
  /** Highlighted/selected index is owned by the parent (keyboard handling). */
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  /** Fires on Enter-over-command / click (parent executes + clears). */
  onExecute: (command: SlashCommand) => void;
}

export function isSlashTokenActive(value: string): boolean {
  if (!value.startsWith("/")) return false;
  // Active while the first token is being typed (no space yet).
  return !value.includes(" ");
}

export function slashToken(value: string): string {
  return value.slice(1).toLowerCase();
}

export function SlashCommandsMenu({
  open,
  commands,
  selectedIndex,
  onSelectIndex,
  onExecute,
}: SlashCommandsProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && commands.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute inset-x-0 bottom-full z-20 mb-2"
          role="listbox"
          aria-label="Команды"
        >
          <div className="vf-scroll mx-auto max-h-72 w-full max-w-3xl overflow-y-auto rounded-2xl border bg-popover/95 p-1.5 shadow-lg backdrop-blur">
            <p className="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Terminal className="size-3" aria-hidden="true" />
              Команды
              <span className="ml-auto hidden normal-case sm:inline">
                <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
                  Tab
                </kbd>{" "}
                дополнить ·{" "}
                <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
                  Enter
                </kbd>{" "}
                выполнить
              </span>
            </p>
            <div ref={listRef} className="space-y-0.5">
              {commands.map((cmd, index) => {
                const Icon = cmd.icon;
                const active = index === selectedIndex;
                return (
                  <button
                    key={cmd.name}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-index={index}
                    onMouseEnter={() => onSelectIndex(index)}
                    onClick={() => onExecute(cmd)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors duration-100",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground/90 hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        active
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-medium">
                        /{cmd.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {cmd.description}
                      </span>
                    </span>
                    {active && (
                      <CornerDownLeft
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Icon per thread mode shared with the slash menu. */
export const SLASH_MODE_ICONS: Record<ThreadMode, typeof HelpCircle> = {
  ask: HelpCircle,
  plan: ListChecks,
  act: Zap,
  review: Search,
};

export const SLASH_MISC_ICONS = {
  note: StickyNote,
  project: FolderGit2,
  notebook: NotebookPen,
  search: Search,
  checkpoint: ListChecks,
  download: Download,
  workspace: LayoutDashboard,
  track: AudioWaveform,
  book: BookOpenText,
  film: Clapperboard,
};

/** Filter commands by the typed token (prefix match, case-insensitive). */
export function filterSlashCommands(
  commands: SlashCommand[],
  token: string,
): SlashCommand[] {
  if (!token) return commands;
  return commands.filter(
    (c) =>
      c.name.startsWith(token) ||
      c.label.toLowerCase().includes(token) ||
      c.description.toLowerCase().includes(token),
  );
}
