"use client";

/**
 * Hosts grid — docker-хосты пользователя. "Развернуть сюда"
 * запускает тот же фейковый пайплайн из шапки экрана.
 */

import {
  ExternalLink,
  KeyRound,
  MoreHorizontal,
  RefreshCw,
  Rocket,
  SquareTerminal,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HOSTS, type DeployHost } from "./deploy-data";

function HostStatusDot({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Подключён
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-stone-500 dark:text-stone-400">
      <span className="size-2 rounded-full bg-stone-400" aria-hidden="true" />
      Не проверялся
    </span>
  );
}

function HostCard({ host, onDeploy }: { host: DeployHost; onDeploy: () => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/25">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold leading-tight">{host.name}</h3>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{host.address}</p>
        </div>
        <HostStatusDot connected={host.connected} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <KeyRound className="size-3" aria-hidden="true" />
          SSH-ключ добавлен
        </span>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {host.app} · {host.version}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Последний деплой: <span className="text-foreground/80">{host.lastDeploy}</span>
      </p>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-lg px-2.5 text-xs"
          onClick={onDeploy}
          aria-label={`Развернуть текущую версию на хост ${host.name}`}
        >
          <Rocket className="size-3.5" aria-hidden="true" />
          Развернуть сюда
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label={`Действия с хостом ${host.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <ExternalLink /> Открыть приложение
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SquareTerminal /> Логи контейнеров
            </DropdownMenuItem>
            <DropdownMenuItem>
              <RefreshCw /> Проверить соединение
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400">
              <Trash2 /> Отключить хост
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export function HostsSection({ onDeploy }: { onDeploy: () => void }) {
  return (
    <section aria-label="Хосты деплоя" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {HOSTS.map((host) => (
        <HostCard key={host.id} host={host} onDeploy={onDeploy} />
      ))}
    </section>
  );
}
