"use client";

/**
 * AdminScreen — center-zone admin panel (replaces the old «скоро» menu item).
 *
 * Three sections (personal-scale honest scope):
 *  - Stats: user/content counters as hover-lift cards;
 *  - Activity: a 14-day stacked bar chart (notes / threads / projects)
 *    rendered with plain divs — no chart lib needed at this scale;
 *  - Users: searchable, role-filterable list with per-user counters and
 *    last activity; actions — promote/demote (guarded server-side) and
 *    delete (AlertDialog + workspace dir cleanup server-side).
 *  Plus the recent audit trail (who did what, when).
 *
 * Non-admins with a stale session see an access notice (the REST layer
 * refuses with 403 anyway — the DB role is the source of truth).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Loader2,
  Menu,
  MessageSquare,
  MessagesSquare,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  Rocket,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AdminAiPanel } from "@/components/app/admin-ai-panel";
import { AdminInvitesPanel } from "@/components/app/admin-invites-panel";
import { AdminOffersPanel } from "@/components/app/admin-offers-panel";
import { AdminPayoutsPanel } from "@/components/app/admin-payouts-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { pluralRu, relativeTime } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import type {
  AdminStats,
  AdminUserListItem,
  AuditLogEntry,
  Role,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface AdminScreenProps {
  onOpenMobileNav: () => void;
}

type RoleFilter = "" | "admin" | "client";
type AdminTab = "overview" | "ai" | "invites" | "payments";

export function AdminScreen({ onOpenMobileNav }: AdminScreenProps) {
  const { user } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<AdminTab>("overview");

  /* ── Initial load: stats + audit (users load through the filter effect) ── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, a] = await Promise.all([api.adminStats(), api.adminAudit(30)]);
        if (!cancelled) {
          setStats(s);
          setAudit(a);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Не удалось загрузить статистику",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadUsers = useCallback(
    async (q: string, role: RoleFilter) => {
      setUsersLoading(true);
      try {
        const list = await api.adminUsers({
          q: q.trim() || undefined,
          role: role || undefined,
        });
        setUsers(list);
        setUsersError(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось загрузить пользователей";
        setUsersError(message);
        toast.error(message);
      } finally {
        setUsersLoading(false);
      }
    },
    [],
  );

  // Debounced user-list fetch (search + role filter).
  useEffect(() => {
    const t = setTimeout(() => void loadUsers(query, roleFilter), 250);
    return () => clearTimeout(t);
  }, [query, roleFilter, loadUsers]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const [s, a] = await Promise.all([api.adminStats(), api.adminAudit(30)]);
      setStats(s);
      setAudit(a);
      setError(null);
      await loadUsers(query, roleFilter);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось обновить данные";
      setError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const changeRole = async (u: AdminUserListItem, role: Role) => {
    try {
      await api.adminUpdateUserRole(u.id, role);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role } : x)),
      );
      toast.success(
        role === "admin"
          ? `${u.name} теперь администратор`
          : `${u.name} теперь обычный пользователь`,
      );
      // The admins counter + audit trail changed — silently resync.
      void Promise.all([api.adminStats(), api.adminAudit(30)])
        .then(([s, a]) => {
          setStats(s);
          setAudit(a);
        })
        .catch(() => {});
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Не удалось изменить роль";
      toast.error(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.adminDeleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast.success(`Пользователь ${deleteTarget.name} удалён`);
      setDeleteTarget(null);
      void Promise.all([api.adminStats(), api.adminAudit(30)])
        .then(([s, a]) => {
          setStats(s);
          setAudit(a);
        })
        .catch(() => {});
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Не удалось удалить пользователя",
      );
    } finally {
      setDeleting(false);
    }
  };

  const activity = stats?.activity ?? [];
  const maxDay = useMemo(
    () =>
      Math.max(
        1,
        ...activity.map((a) => a.notes + a.threads + a.projects),
      ),
    [activity],
  );

  /* ── Stale non-admin session → honest access notice ── */
  if (user && user.role !== "admin") {
    return (
      <section
        aria-label="Админ-панель"
        className="flex min-w-0 flex-1 flex-col bg-background"
      >
        <Header onOpenMobileNav={onOpenMobileNav} />
        <div className="vf-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="size-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Доступ только для администраторов</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ваша роль изменилась. Обновите страницу, чтобы интерфейс
              синхронизировался.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Админ-панель"
      className="flex min-w-0 flex-1 flex-col bg-background"
    >
      <Header
        onOpenMobileNav={onOpenMobileNav}
        onRefresh={() => void refreshAll()}
        refreshing={refreshing}
        tab={tab}
        onTab={setTab}
      />

      {/* ── Feed ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
          {tab === "ai" ? (
            <AdminAiPanel />
          ) : tab === "invites" ? (
            <AdminInvitesPanel />
          ) : tab === "payments" ? (
            <div className="space-y-8">
              <AdminOffersPanel />
              <AdminPayoutsPanel />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="size-6 text-destructive" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => void refreshAll()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Повторить
              </Button>
            </div>
          ) : loading ? (
            <AdminSkeleton />
          ) : stats ? (
            <>
              {/* ── Stats cards ── */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <StatCard
                  icon={Users}
                  label="Пользователи"
                  value={stats.users}
                  sub={`${stats.admins} ${pluralRu(stats.admins, "админ", "админа", "админов")} · +${stats.newUsers7d} за неделю`}
                  delay={0}
                />
                <StatCard
                  icon={NotebookPen}
                  label="Заметки"
                  value={stats.notes}
                  sub={`${stats.notesProcessed} проанализировано${stats.notesError > 0 ? ` · ${stats.notesError} с ошибкой` : ""}`}
                  delay={0.04}
                />
                <StatCard
                  icon={Rocket}
                  label="Воркспейсы"
                  value={stats.workspaces}
                  sub={
                    stats.projects === stats.workspaces
                      ? `${stats.categories} ${pluralRu(stats.categories, "категория", "категории", "категорий")}`
                      : `${stats.projects} ${pluralRu(stats.projects, "проект", "проекта", "проектов")} всего`
                  }
                  delay={0.08}
                />
                <StatCard
                  icon={MessageSquare}
                  label="Диалоги"
                  value={stats.threads}
                  sub={`${stats.messages} ${pluralRu(stats.messages, "сообщение", "сообщения", "сообщений")}`}
                  delay={0.12}
                />
                <StatCard
                  icon={MessagesSquare}
                  label="Сообщения"
                  value={stats.messages}
                  sub="во всех диалогах"
                  delay={0.16}
                />
                <StatCard
                  icon={Bell}
                  label="Уведомления"
                  value={stats.notifications}
                  sub="в историях колокольчиков"
                  delay={0.2}
                />
              </div>

              {/* ── Activity chart ── */}
              <div className="rounded-2xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">Активность за 14 дней</h2>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      заметки
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-stone-400 dark:bg-stone-500" aria-hidden="true" />
                      диалоги
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                      проекты
                    </span>
                  </div>
                </div>
                <div
                  className="mt-4 flex h-28 items-end gap-1 sm:gap-1.5"
                  role="img"
                  aria-label="Столбчатая диаграмма создания заметок, диалогов и проектов за последние 14 дней"
                >
                  {activity.map((day) => {
                    const total = day.notes + day.threads + day.projects;
                    const title = `${day.date}: ${day.notes} ${pluralRu(day.notes, "заметка", "заметки", "заметок")}, ${day.threads} ${pluralRu(day.threads, "диалог", "диалога", "диалогов")}, ${day.projects} ${pluralRu(day.projects, "проект", "проекта", "проектов")}`;
                    return (
                      <div
                        key={day.date}
                        className="flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5"
                        title={title}
                      >
                        <div className="flex h-full flex-col justify-end overflow-hidden rounded-t-md">
                          {total === 0 ? (
                            <div className="h-1 rounded-t-sm bg-muted" />
                          ) : (
                            <>
                              {day.projects > 0 && (
                                <div
                                  className="w-full bg-amber-500/80"
                                  style={{ height: `${(day.projects / maxDay) * 100}%` }}
                                />
                              )}
                              {day.threads > 0 && (
                                <div
                                  className="w-full bg-stone-400/70 dark:bg-stone-500/70"
                                  style={{ height: `${(day.threads / maxDay) * 100}%` }}
                                />
                              )}
                              {day.notes > 0 && (
                                <div
                                  className="w-full bg-emerald-500/80"
                                  style={{ height: `${(day.notes / maxDay) * 100}%` }}
                                />
                              )}
                            </>
                          )}
                        </div>
                        <span className="text-center text-[9px] leading-none text-muted-foreground/70 tabular-nums">
                          {day.date.slice(8, 10)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Users ── */}
              <div className="rounded-2xl border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Пользователи</h2>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <div className="relative min-w-0 flex-1 sm:max-w-64">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Имя или email…"
                        aria-label="Поиск пользователей"
                        className="h-9 rounded-xl pl-9 text-sm"
                      />
                    </div>
                    <Tabs
                      value={roleFilter || "all"}
                      onValueChange={(v) =>
                        setRoleFilter(v === "all" ? "" : (v as RoleFilter))
                      }
                    >
                      <TabsList className="h-9 rounded-xl">
                        <TabsTrigger value="all" className="h-7 rounded-lg text-xs">
                          Все
                        </TabsTrigger>
                        <TabsTrigger value="admin" className="h-7 rounded-lg text-xs">
                          Админы
                        </TabsTrigger>
                        <TabsTrigger value="client" className="h-7 rounded-lg text-xs">
                          Клиенты
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="mt-4">
                  {usersLoading && users.length === 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : usersError && users.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm text-muted-foreground">{usersError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => void loadUsers(query, roleFilter)}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        Повторить
                      </Button>
                    </div>
                  ) : users.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {query.trim() || roleFilter
                        ? "Никого не найдено — попробуйте изменить фильтр"
                        : "Пока нет пользователей"}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {users.map((u) => {
                        const isSelf = u.id === user?.id;
                        const initials = u.name
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? "")
                          .join("");
                        return (
                          <motion.li
                            key={u.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                            className={cn(
                              "rounded-xl border p-3.5 transition-colors duration-150 hover:border-primary/25",
                              isSelf && "border-primary/30 bg-primary/[0.03]",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <Avatar className="size-9 shrink-0">
                                  <AvatarFallback
                                    className={cn(
                                      "text-xs font-semibold",
                                      u.role === "admin"
                                        ? "bg-primary/15 text-primary"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {initials || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate text-sm font-medium">
                                      {u.name}
                                    </span>
                                    <Badge
                                      variant={u.role === "admin" ? "default" : "secondary"}
                                      className="rounded-full px-1.5 text-[10px]"
                                    >
                                      {u.role === "admin" ? "админ" : "клиент"}
                                    </Badge>
                                    {isSelf && (
                                      <span className="text-[10px] text-muted-foreground">
                                        это вы
                                      </span>
                                    )}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {u.email}
                                  </p>
                                </div>
                              </div>
                              <UserActions
                                target={u}
                                isSelf={isSelf}
                                onChangeRole={(role) => void changeRole(u, role)}
                                onDelete={() => setDeleteTarget(u)}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <NotebookPen className="size-3.5" aria-hidden="true" />
                                {u.counts.notes}{" "}
                                {pluralRu(u.counts.notes, "заметка", "заметки", "заметок")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Rocket className="size-3.5" aria-hidden="true" />
                                {u.counts.projects}{" "}
                                {pluralRu(u.counts.projects, "проект", "проекта", "проектов")}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="size-3.5" aria-hidden="true" />
                                {u.counts.threads}{" "}
                                {pluralRu(u.counts.threads, "диалог", "диалога", "диалогов")}
                              </span>
                              <span className="ml-auto">
                                {u.lastActivity
                                  ? `активность ${relativeTime(u.lastActivity)}`
                                  : "ещё ничего не делал"}
                              </span>
                            </div>
                          </motion.li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* ── Audit trail ── */}
              <div className="rounded-2xl border bg-card p-4 sm:p-6">
                <h2 className="text-sm font-semibold">Журнал событий</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  последние {audit.length} записей — входы, регистрации и
                  действия администраторов
                </p>
                <ul className="mt-3">
                  {audit.length === 0 ? (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Журнал пока пуст
                    </li>
                  ) : (
                    audit.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0"
                      >
                        <Badge
                          variant={e.action.startsWith("admin.") ? "default" : "secondary"}
                          className="shrink-0 rounded-full px-1.5 font-mono text-[10px]"
                        >
                          {e.action}
                        </Badge>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {e.user ? `${e.user.name} · ${e.user.email}` : "система"}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/80">
                          {relativeTime(e.createdAt)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Аккаунт «{deleteTarget.name}» ({deleteTarget.email}) и все
                  его данные — заметки, диалоги, проекты с файлами и git-историей —
                  будут удалены безвозвратно.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Удаляем…
                </>
              ) : (
                "Удалить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ── Sub-components ── */

function Header({
  onOpenMobileNav,
  onRefresh,
  refreshing,
  tab,
  onTab,
}: {
  onOpenMobileNav: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  tab?: AdminTab;
  onTab?: (tab: AdminTab) => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="size-9 md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Открыть меню"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>
      <h1 className="truncate text-sm font-semibold sm:text-[15px]">
        🛡 Админ-панель
      </h1>
      {onTab && (
        <Tabs value={tab} onValueChange={(v) => onTab(v as AdminTab)}>
          <TabsList className="vf-scroll-x h-8 max-w-full overflow-x-auto rounded-xl">
            <TabsTrigger value="overview" className="h-6 rounded-lg text-xs">
              Обзор
            </TabsTrigger>
            <TabsTrigger value="ai" className="h-6 rounded-lg gap-1 text-xs">
              <Sparkles className="size-3" />
              Модели ИИ
            </TabsTrigger>
            <TabsTrigger value="invites" className="h-6 rounded-lg text-xs">
              Инвайты
            </TabsTrigger>
            <TabsTrigger value="payments" className="h-6 rounded-lg text-xs">
              Оплаты
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <div className="flex-1" />
      {onRefresh && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Обновить данные"
        >
          <RefreshCw
            className={cn("size-4", refreshing && "animate-spin")}
            aria-hidden="true"
          />
        </Button>
      )}
    </header>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="group rounded-2xl border bg-card p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon
          className="size-4 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
        {value.toLocaleString("ru-RU")}
      </p>
      <p className="mt-1 truncate text-[11px] leading-relaxed text-muted-foreground/80">
        {sub}
      </p>
    </motion.div>
  );
}

function UserActions({
  target,
  isSelf,
  onChangeRole,
  onDelete,
}: {
  target: AdminUserListItem;
  isSelf: boolean;
  onChangeRole: (role: Role) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-lg"
          aria-label={`Действия с пользователем ${target.name}`}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Роль
        </DropdownMenuLabel>
        {target.role === "client" ? (
          <DropdownMenuItem onSelect={() => onChangeRole("admin")}>
            <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Сделать админом
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onChangeRole("client")}>
            <ArrowDownRight className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Сделать клиентом
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSelf}
          onSelect={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Удалить аккаунт
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
