"use client";

import { AnimatePresence } from "framer-motion";
import { Download, Plus, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  ModuleHeader,
  WipBanner,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";

import { MY_SKILLS, type MySkill } from "./data";
import { SectionHeading } from "./section-heading";
import { SkillCard } from "./skill-card";
import { SkillDetail } from "./skill-detail";
import { StoreSection } from "./store-section";

/**
 * Skills module — my installed skills (toggle/inspect/duplicate/delete),
 * a store row with importable packs and a SKILL.md detail card.
 * Pure visual mock: everything lives in local state.
 */
export function SkillsScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [skills, setSkills] = useState<MySkill[]>(MY_SKILLS);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MY_SKILLS.map((s) => [s.id, s.enabled])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const detailRef = useRef<HTMLDivElement | null>(null);

  const selected = skills.find((s) => s.id === selectedId) ?? null;
  const enabledCount = skills.filter((s) => enabledMap[s.id]).length;

  // Bring the freshly opened detail card into view (mobile especially).
  useEffect(() => {
    if (!selectedId) return;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const handleToggle = (id: string, next: boolean) => {
    setEnabledMap((prev) => ({ ...prev, [id]: next }));
  };

  const handleDuplicate = (id: string) => {
    const source = skills.find((s) => s.id === id);
    if (!source) return;
    const copy: MySkill = {
      ...source,
      id: `${id}-copy`,
      name: `${source.name} (копия)`,
      source: "created",
      enabled: true,
      usedCount: 0,
    };
    setSkills((prev) => [...prev, copy]);
    setEnabledMap((prev) => ({ ...prev, [copy.id]: true }));
    setSelectedId(copy.id);
  };

  const handleDelete = (id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  const handleImport = (id: string) => {
    setImportedIds((prev) => new Set(prev).add(id));
  };

  return (
    <section
      aria-label="Скиллы"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Wand2}
        title="Скиллы"
        description="Импортируйте и создавайте навыки для оркестратора"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm">
          <Download className="size-4" aria-hidden="true" />
          Импортировать
        </Button>
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Создать скилл
        </Button>
      </ModuleHeader>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          <section aria-label="Мои скиллы" className="space-y-3">
            <SectionHeading
              title="Мои скиллы"
              hint={`включено ${enabledCount} из ${skills.length}`}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  enabled={Boolean(enabledMap[skill.id])}
                  selected={skill.id === selectedId}
                  onSelect={setSelectedId}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </section>

          <AnimatePresence>
            {selected ? (
              <div key={selected.id} ref={detailRef}>
                <SkillDetail
                  skill={selected}
                  onClose={() => setSelectedId(null)}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              </div>
            ) : null}
          </AnimatePresence>

          <section
            aria-label="Магазин скиллов"
            className="space-y-3 pb-1"
          >
            <SectionHeading
              title="Доступные для импорта"
              hint="выборка из магазина сообщества"
            />
            <StoreSection importedIds={importedIds} onImport={handleImport} />
          </section>

          <WipBanner
            title="Магазин скиллов — скоро"
            description="Магазин скиллов и импорт по URL заработают после обновления ядра"
            features={["SKILL.md", "триггеры", "инструменты"]}
          />
        </div>
      </div>
    </section>
  );
}
