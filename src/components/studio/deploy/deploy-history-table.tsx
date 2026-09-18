"use client";

/**
 * Deploy history table — последние релизы по хостам.
 */

import { Check, RotateCcw, X } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEPLOY_HISTORY, type DeployRecord, type DeployResult } from "./deploy-data";
import { cn } from "@/lib/utils";

const RESULT_META: Record<
  DeployResult,
  { label: string; icon: typeof Check; className: string }
> = {
  success: {
    label: "Успех",
    icon: Check,
    className: "text-emerald-700 dark:text-emerald-400",
  },
  rollback: {
    label: "Откат",
    icon: RotateCcw,
    className: "text-stone-600 dark:text-stone-400",
  },
  failed: {
    label: "Ошибка",
    icon: X,
    className: "text-red-600 dark:text-red-400",
  },
};

function ResultCell({ result }: { result: DeployResult }) {
  const meta = RESULT_META[result];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", meta.className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function EnvChip({ env }: { env: DeployRecord["env"] }) {
  return env === "prod" ? (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      prod
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
      stage
    </span>
  );
}

export function DeployHistoryTable() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold leading-tight">История деплоев</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {DEPLOY_HISTORY.length} записей
        </span>
      </header>
      <Table className="[&_td]:py-2.5">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 sm:pl-5">Версия</TableHead>
            <TableHead>Хост</TableHead>
            <TableHead>Окружение</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Время</TableHead>
            <TableHead className="pr-4 sm:pr-5">Коммит</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DEPLOY_HISTORY.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="pl-4 font-mono text-xs sm:pl-5">{row.version}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.host}</TableCell>
              <TableCell>
                <EnvChip env={row.env} />
              </TableCell>
              <TableCell>
                <ResultCell result={row.result} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {row.time}
              </TableCell>
              <TableCell className="max-w-[16rem] pr-4 sm:pr-5">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <code className="shrink-0 font-mono text-xs text-foreground/80">
                    {row.commit}
                  </code>
                  <span className="truncate text-xs text-muted-foreground">{row.message}</span>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
