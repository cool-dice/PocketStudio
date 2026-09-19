"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export function AdminInvitesPanel() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"client" | "admin">("client");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.listInvites>>>(
    [],
  );

  const load = useCallback(async () => {
    try {
      setRows(await api.listInvites());
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось загрузить инвайты",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const invite = await api.createInvite(email.trim(), role);
      const url = `${window.location.origin}/login?tab=register&invite=${invite.token}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Инвайт создан, ссылка в буфере");
      setEmail("");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось создать инвайт",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">Пригласить пользователя</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ссылка действует 14 дней. Регистрация по токену назначает выбранную роль.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 text-xs text-muted-foreground">
            Email
            <Input
              className="mt-1"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@studio.local"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Роль
            <select
              className="mt-1 h-9 rounded-md border bg-background px-2 text-sm"
              value={role}
              onChange={(e) =>
                setRole(e.target.value === "admin" ? "admin" : "client")
              }
            >
              <option value="client">клиент</option>
              <option value="admin">админ</option>
            </select>
          </label>
          <Button size="sm" disabled={busy || !email.trim()} onClick={() => void create()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Создать ссылку
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Пока нет инвайтов
          </li>
        ) : (
          rows.map((row) => {
            const url = `/login?tab=register&invite=${row.token}`;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm"
              >
                <Link2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">{row.email}</span>
                <span className="text-xs text-muted-foreground">{row.role}</span>
                <span className="text-xs text-muted-foreground">
                  {row.usedAt ? "использован" : "ожидает"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => {
                    const full = `${window.location.origin}${url}`;
                    void navigator.clipboard.writeText(full);
                    toast.success("Ссылка скопирована");
                  }}
                >
                  <Copy className="size-3.5" />
                  Копировать
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
