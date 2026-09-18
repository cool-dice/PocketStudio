"use client";

/**
 * Диалог «+ Сущность»: домен (narrative/product) → вид (чипы с иконками,
 * состав зависит от домена) → название. Если выбран домен без сущест-
 * вующего набора — поле названия нового набора. Создаёт через API.
 */

import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EntityDomain, EntityKind } from "@/lib/workspace-types";
import {
  ENTITY_KIND_META,
  PRODUCT_KINDS,
  NARRATIVE_KINDS,
  kindsOfDomain,
} from "./entities-data";
import { SelectableChip } from "./narrative-chip";

const DOMAIN_META: { id: EntityDomain; label: string; hint: string }[] = [
  { id: "narrative", label: "Художественный текст", hint: "персонажи, локации, события, предметы, фракции, правила" },
  { id: "product", label: "Продукт и документация", hint: "пользователи, роли, требования, модули, интеграции" },
];

export interface CreateEntityPayload {
  kind: EntityKind;
  name: string;
  domain: EntityDomain;
  setId: string;
  setName: string;
}

export function EntityCreateDialog({
  open,
  onOpenChange,
  onCreate,
  sets,
  activeSetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: CreateEntityPayload) => Promise<void>;
  /** Существующие наборы — чтобы по умолчанию создать в активном. */
  sets: { id: string; name: string; domain: EntityDomain }[];
  activeSetId: string | null;
}) {
  const [domain, setDomain] = useState<EntityDomain>("narrative");
  const [kind, setKind] = useState<EntityKind>("character");
  const [name, setName] = useState("");
  const [setLabel, setSetLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const kinds = useMemo(() => kindsOfDomain(domain), [domain]);
  const matchingSet = sets.find((set) => set.id === activeSetId && set.domain === domain);

  // Открытие: домен и вид — от активного набора (если есть).
  useEffect(() => {
    if (!open) return;
    const initial = sets.find((set) => set.id === activeSetId);
    if (initial) {
      setDomain(initial.domain);
      setKind(kindsOfDomain(initial.domain)[0]);
    }
    setName("");
    setSetLabel("");
  }, [open, sets, activeSetId]);

  function switchDomain(next: EntityDomain) {
    setDomain(next);
    setKind(kindsOfDomain(next)[0]);
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreate({
        kind,
        name: trimmed,
        domain,
        setId: matchingSet?.id ?? `set-${domain}-${Date.now().toString(36)}`,
        setName: matchingSet?.name ?? (setLabel.trim() || "Новый набор"),
      });
      onOpenChange(false);
    } catch {
      /* toast уже показан родителем */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новая сущность</DialogTitle>
          <DialogDescription>
            Запись появится в наборе и в каталоге вкладки сразу после создания.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Домен
            </p>
            <div className="grid gap-1.5">
              {DOMAIN_META.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchDomain(item.id)}
                  aria-pressed={domain === item.id}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left transition-colors",
                    domain === item.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:border-foreground/25 hover:bg-accent",
                  )}
                >
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Вид
            </p>
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((kindId) => {
                const meta = ENTITY_KIND_META[kindId];
                return (
                  <SelectableChip
                    key={kindId}
                    label={meta.plural}
                    icon={meta.icon}
                    selected={kind === kindId}
                    onClick={() => setKind(kindId)}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Название
            </p>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Марина — автор-новичок"
              aria-label="Название сущности"
              maxLength={120}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </div>

          {matchingSet ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Будет добавлена в набор «{matchingSet.name}».
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Название нового набора
              </p>
              <Input
                value={setLabel}
                onChange={(event) => setSetLabel(event.target.value)}
                placeholder="Например: Лор второго тома"
                aria-label="Название набора"
                maxLength={120}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={submit} disabled={!name.trim() || busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
