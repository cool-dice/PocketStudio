"use client";

/**
 * Skills module — SKILL.md in DB: toggle, import, create, store catalog.
 * Enabled skills are injected into the agent system prompt.
 */

import { AnimatePresence } from "framer-motion";
import { Download, Plus, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { SkillDto, StoreSkillDto } from "@/lib/skill-shapes";
import { type MySkill, type SkillSource } from "./data";
import { skillIcon } from "./icon-map";
import { SectionHeading } from "./section-heading";
import { SkillCard } from "./skill-card";
import { SkillDetail } from "./skill-detail";
import { StoreSection } from "./store-section";

function toCard(skill: SkillDto): MySkill {
  const source: SkillSource =
    skill.source === "store" ? "imported" : skill.source;
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    source,
    enabled: skill.enabled,
    usedCount: skill.usedCount,
    icon: skillIcon(skill.icon),
    triggers: skill.triggers,
    skillMd: skill.skillMd,
  };
}

export function SkillsScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [store, setStore] = useState<StoreSkillDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listSkills();
      setSkills(res.skills);
      setStore(res.store);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось загрузить скиллы");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const selected = skills.find((s) => s.id === selectedId) ?? null;
  const enabledCount = skills.filter((s) => s.enabled).length;
  const importedIds = new Set(
    store.filter((s) => s.imported).map((s) => s.key),
  );

  async function handleToggle(id: string, next: boolean) {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: next } : s)));
    try {
      await api.updateSkill(id, { enabled: next });
    } catch (err) {
      setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !next } : s)));
      toast.error(err instanceof ApiError ? err.message : "Не удалось переключить скилл");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const copy = await api.duplicateSkill(id);
      setSkills((prev) => [...prev, copy]);
      setSelectedId(copy.id);
      toast.success("Скилл скопирован");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось скопировать");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
      toast.success("Скилл удалён");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось удалить");
    }
  }

  async function handleImport(key: string) {
    try {
      const skill = await api.importSkill({ catalogKey: key });
      setSkills((prev) =>
        prev.some((s) => s.id === skill.id) ? prev : [...prev, skill],
      );
      setStore((prev) =>
        prev.map((s) => (s.key === key ? { ...s, imported: true } : s)),
      );
      toast.success("Скилл импортирован и включён в промпт агента");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось импортировать");
    }
  }

  return (
    <section
      aria-label="Скиллы"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Wand2}
        title="Скиллы"
        description="SKILL.md для оркестратора: включённые скиллы попадают в системный промпт"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Download className="size-4" aria-hidden="true" />
          Импортировать
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Создать скилл
        </Button>
      </ModuleHeader>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          <section aria-label="Мои скиллы" className="space-y-3">
            <SectionHeading
              title="Мои скиллы"
              hint={
                loading
                  ? "загрузка…"
                  : `включено ${enabledCount} из ${skills.length}`
              }
            />
            {skills.length === 0 && !loading ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                Пока нет скиллов — импортируйте из магазина или создайте SKILL.md.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {skills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={toCard(skill)}
                    enabled={skill.enabled}
                    selected={skill.id === selectedId}
                    onSelect={setSelectedId}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </section>

          <AnimatePresence>
            {selected ? (
              <div key={selected.id} ref={detailRef}>
                <SkillDetail
                  skill={toCard(selected)}
                  onClose={() => setSelectedId(null)}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onEdit={() => setEditOpen(true)}
                />
              </div>
            ) : null}
          </AnimatePresence>

          <section aria-label="Магазин скиллов" className="space-y-3 pb-1">
            <SectionHeading
              title="Магазин скиллов"
              hint="внутренний каталог: «купить» = импорт и флаг purchased, без Stripe"
            />
            <StoreSection
              importedIds={importedIds}
              onImport={handleImport}
              items={store}
            />
          </section>
        </div>
      </div>

      <SkillFormDialog
        open={createOpen}
        title="Новый скилл"
        description="Файл SKILL.md станет частью системного промпта, пока скилл включён."
        onClose={() => setCreateOpen(false)}
        onSubmit={async (values) => {
          const skill = await api.createSkill(values);
          setSkills((prev) => [...prev, skill]);
          setSelectedId(skill.id);
          setCreateOpen(false);
          toast.success("Скилл создан и включён");
        }}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(skill) => {
          setSkills((prev) => [...prev, skill]);
          setSelectedId(skill.id);
          setImportOpen(false);
        }}
      />

      {selected ? (
        <SkillFormDialog
          open={editOpen}
          title="Изменить скилл"
          description="Правки SKILL.md сразу видны оркестратору."
          initial={{
            name: selected.name,
            description: selected.description,
            skillMd: selected.skillMd,
            triggers: selected.triggers.join(", "),
          }}
          onClose={() => setEditOpen(false)}
          onSubmit={async (values) => {
            const updated = await api.updateSkill(selected.id, values);
            setSkills((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s)),
            );
            setEditOpen(false);
            toast.success("Скилл обновлён");
          }}
        />
      ) : null}
    </section>
  );
}

function SkillFormDialog({
  open,
  title,
  description,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initial?: { name: string; description: string; skillMd: string; triggers: string };
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    description?: string;
    skillMd: string;
    triggers: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [descriptionText, setDescriptionText] = useState(initial?.description ?? "");
  const [skillMd, setSkillMd] = useState(initial?.skillMd ?? "");
  const [triggers, setTriggers] = useState(initial?.triggers ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescriptionText(initial?.description ?? "");
      setSkillMd(
        initial?.skillMd ??
          `---\nname: Новый скилл\ntriggers: []\n---\n\n## Когда использовать\n\n## Шаги\n1. \n`,
      );
      setTriggers(initial?.triggers ?? "");
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название"
            aria-label="Название скилла"
          />
          <Input
            value={descriptionText}
            onChange={(e) => setDescriptionText(e.target.value)}
            placeholder="Короткое описание"
            aria-label="Описание скилла"
          />
          <Input
            value={triggers}
            onChange={(e) => setTriggers(e.target.value)}
            placeholder="Триггеры через запятую"
            aria-label="Триггеры"
          />
          <Textarea
            value={skillMd}
            onChange={(e) => setSkillMd(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            aria-label="SKILL.md"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={busy || !name.trim() || skillMd.trim().length < 8}
            onClick={() => {
              setBusy(true);
              void onSubmit({
                name: name.trim(),
                description: descriptionText.trim(),
                skillMd: skillMd.trim(),
                triggers: triggers
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
              }).finally(() => setBusy(false));
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (skill: SkillDto) => void;
}) {
  const [url, setUrl] = useState("");
  const [skillMd, setSkillMd] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Импорт SKILL.md</DialogTitle>
          <DialogDescription>
            Вставьте URL сырого markdown или сам текст файла.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/SKILL.md"
            aria-label="URL SKILL.md"
          />
          <Textarea
            value={skillMd}
            onChange={(e) => setSkillMd(e.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder="Или вставьте SKILL.md сюда"
            aria-label="Текст SKILL.md"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={busy || (!url.trim() && skillMd.trim().length < 8)}
            onClick={async () => {
              setBusy(true);
              try {
                const skill = await api.importSkill({
                  url: url.trim() || undefined,
                  skillMd: skillMd.trim() || undefined,
                });
                onImported(skill);
                toast.success("SKILL.md импортирован");
              } catch (err) {
                toast.error(
                  err instanceof ApiError ? err.message : "Не удалось импортировать",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Импортировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

