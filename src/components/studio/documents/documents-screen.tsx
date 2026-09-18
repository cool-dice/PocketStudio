"use client";

/**
 * Документы → NarrativeCore. Оболочка модуля с четырьмя вкладками:
 * Рукопись (трёхпанельный редактор), Сущности (универсальный каталог
 * для текста и документации), Альбом и Аналитик (поиск противоречий
 * и расхождений). Портреты и вариации генерируются моком: таймер живёт
 * здесь, чтобы результат долетал до альбома даже при смене вкладки.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  ListPlus,
  Newspaper,
  Plus,
  Save,
  ScanSearch,
  Shapes,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleHeader, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { AlbumTab } from "./album-tab";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { AnalystTab } from "./analyst-tab";
import { ChapterTree, ChapterTreeEmpty } from "./chapter-tree";
import { DocChipsBar, DocumentLibrary } from "./doc-library";
import { DocumentTitleRow, EditorFooterStats, EditorPage } from "./editor-page";
import { EditorToolbar } from "./editor-toolbar";
import { EntitiesTab } from "./entities-tab";
import { ALBUM_ITEMS, type AlbumItem } from "./album-data";
import { ENTITY_SETS } from "./entities-data";
import { PORTRAIT_VARIANTS } from "./narrative-data";
import { MOCK_DOCS } from "./types";
import type { StoryCharacter } from "./character-data";

const NEW_DOC_ITEMS: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: BookOpenText, label: "Книга", hint: "роман или нон-фикшн с главами" },
  { icon: Newspaper, label: "Статья", hint: "пост, колонка или гайд" },
  { icon: Clapperboard, label: "Сценарий", hint: "сцены, реплики, раскадровка" },
  { icon: ListPlus, label: "Глава", hint: "добавить в текущую книгу" },
];

type ModuleTab = "manuscript" | "entities" | "album" | "analyst";

export function DocumentsScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [tab, setTab] = useState<ModuleTab>("manuscript");
  const [activeDocId, setActiveDocId] = useState(MOCK_DOCS[0].id);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    MOCK_DOCS[0].chapters?.find((chapter) => chapter.status === "current")?.id ?? null,
  );
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>(ALBUM_ITEMS);
  const [portraitOverrides, setPortraitOverrides] = useState<Record<string, string>>({});
  const [portraitGenId, setPortraitGenId] = useState<string | null>(null);
  const [generatingVariationId, setGeneratingVariationId] = useState<string | null>(null);
  const [focusEntityId, setFocusEntityId] = useState<string | null>(null);

  const variantCounterRef = useRef(0);
  const portraitTimerRef = useRef<number | null>(null);
  const variationTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (portraitTimerRef.current !== null) window.clearTimeout(portraitTimerRef.current);
      if (variationTimerRef.current !== null) window.clearTimeout(variationTimerRef.current);
    },
    [],
  );

  const activeDoc = MOCK_DOCS.find((doc) => doc.id === activeDocId) ?? MOCK_DOCS[0];
  const activeChapter = activeDoc.chapters?.find((chapter) => chapter.id === activeChapterId) ?? null;

  function handleSelectDoc(id: string) {
    setActiveDocId(id);
    const doc = MOCK_DOCS.find((item) => item.id === id);
    setActiveChapterId(doc?.chapters?.find((chapter) => chapter.status === "current")?.id ?? null);
  }

  function handleTabChange(value: string) {
    setTab(value as ModuleTab);
    if (value !== "entities") setFocusEntityId(null);
  }

  function handleOpenEntity(entityId: string) {
    setFocusEntityId(entityId);
    setTab("entities");
  }

  function nextVariantGradient(): string {
    const gradient = PORTRAIT_VARIANTS[variantCounterRef.current % PORTRAIT_VARIANTS.length];
    variantCounterRef.current += 1;
    return gradient;
  }

  /** Мок «Сгенерировать портрет по описанию»: спиннер → новый портрет + тайл в альбоме. */
  function handleGeneratePortrait(character: StoryCharacter) {
    if (portraitGenId !== null) return;
    setPortraitGenId(character.id);
    portraitTimerRef.current = window.setTimeout(() => {
      const gradient = nextVariantGradient();
      setPortraitOverrides((prev) => ({ ...prev, [character.id]: gradient }));
      setAlbumItems((prev) => [
        {
          id: `al-${character.id}-${Date.now()}`,
          kind: "portrait",
          title: `${character.name} — портрет по описанию`,
          entityId: character.id,
          entityName: character.name,
          isCharacter: true,
          gradient,
          description: `Сгенерировано по биографии: ${character.short} Свет — очаг слева, взгляд тише, чем в прошлой версии.`,
          createdAtAgo: 0,
          isGenerated: true,
        },
        ...prev,
      ]);
      setPortraitGenId(null);
      toast.success("Портрет готов", {
        description: `Обновлён в карточке «${character.name}» и добавлен в Альбом.`,
      });
    }, 1800);
  }

  /** Мок «Сгенерировать вариацию»: спиннер → новый тайл в альбоме. */
  function handleGenerateVariation(item: AlbumItem) {
    if (generatingVariationId !== null) return;
    setGeneratingVariationId(item.id);
    variationTimerRef.current = window.setTimeout(() => {
      const gradient = nextVariantGradient();
      setAlbumItems((prev) => [
        {
          id: `al-var-${item.id}-${Date.now()}`,
          kind: item.kind,
          title: `${item.title} · вариация`,
          entityId: item.entityId,
          entityName: item.entityName,
          isCharacter: item.isCharacter,
          gradient,
          description: `Вариация работы «${item.title}»: изменены ракурс, свет и палитра.`,
          createdAtAgo: 0,
          isGenerated: true,
        },
        ...prev,
      ]);
      setGeneratingVariationId(null);
      toast.success("Вариация готова", {
        description: "Новый тайл добавлен в начало альбома.",
      });
    }, 1500);
  }

  return (
    <section aria-label="Документы" className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <ModuleHeader
        icon={BookOpenText}
        title="Документы"
        description="Рукопись, сущности, альбом и аналитик — тексты и документация"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button">
              <Plus className="size-4" aria-hidden="true" />
              Новый документ
              <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {NEW_DOC_ITEMS.map((item) => (
              <DropdownMenuItem key={item.label} className="items-start gap-2.5 py-2">
                <item.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">{item.hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              Импорт из Markdown — скоро
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="outline">
          <Save className="size-4" aria-hidden="true" />
          Сохранить
        </Button>
      </ModuleHeader>

      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b bg-background px-3 py-2 sm:px-4">
          <TabsList className="vf-scroll-x h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            <TabTrigger icon={BookOpenText} value="manuscript" label="Рукопись" />
            <TabTrigger
              icon={Shapes}
              value="entities"
              label="Сущности"
              count={ENTITY_SETS[0].entities.length}
            />
            <TabTrigger icon={ImageIcon} value="album" label="Альбом" count={albumItems.length} />
            <TabTrigger icon={ScanSearch} value="analyst" label="Аналитик" />
          </TabsList>
        </div>

        {/* Рукопись: трёхпанельный редактор */}
        <TabsContent value="manuscript" className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Слева: библиотека документов (lg+) */}
            <nav
              aria-label="Библиотека документов"
              className="hidden w-64 shrink-0 flex-col border-r bg-background lg:flex"
            >
              <DocumentLibrary docs={MOCK_DOCS} activeId={activeDocId} onSelect={handleSelectDoc} />
            </nav>

            {/* Центр: редактор */}
            <main aria-label="Редактор документа" className="flex min-w-0 flex-1 flex-col bg-card">
              <DocChipsBar docs={MOCK_DOCS} activeId={activeDocId} onSelect={handleSelectDoc} />
              <DocumentTitleRow doc={activeDoc} chapter={activeChapter} />
              <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
                <EditorToolbar />
                <EditorPage doc={activeDoc} chapter={activeChapter} />
              </div>
              <EditorFooterStats doc={activeDoc} chapter={activeChapter} />
            </main>

            {/* Справа: структура и ИИ-помощник (xl+) */}
            <aside
              aria-label="Структура документа и ИИ-помощник"
              className="hidden w-72 shrink-0 flex-col border-l bg-background xl:flex"
            >
              <Tabs defaultValue="structure" className="flex min-h-0 flex-1 flex-col gap-0">
                <div className="shrink-0 border-b p-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="structure">Структура</TabsTrigger>
                    <TabsTrigger value="ai">ИИ-помощник</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="structure" className="flex min-h-0 flex-1 flex-col">
                  {activeDoc.chapters ? (
                    <ChapterTree
                      doc={activeDoc}
                      currentId={activeChapterId}
                      onSelect={setActiveChapterId}
                    />
                  ) : (
                    <ChapterTreeEmpty doc={activeDoc} />
                  )}
                </TabsContent>
                <TabsContent value="ai" className="flex min-h-0 flex-1 flex-col">
                  <AiAssistantPanel />
                </TabsContent>
              </Tabs>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="entities" className="flex min-h-0 flex-1 flex-col">
          <EntitiesTab
            focusEntityId={focusEntityId}
            portraitOverrides={portraitOverrides}
            generatingPortraitId={portraitGenId}
            onGeneratePortrait={handleGeneratePortrait}
          />
        </TabsContent>

        <TabsContent value="album" className="flex min-h-0 flex-1 flex-col">
          <AlbumTab
            items={albumItems}
            generatingVariationId={generatingVariationId}
            onGenerateVariation={handleGenerateVariation}
            onOpenEntity={handleOpenEntity}
          />
        </TabsContent>

        <TabsContent value="analyst" className="flex min-h-0 flex-1 flex-col">
          <AnalystTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TabTrigger({
  icon: Icon,
  value,
  label,
  count,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs data-[state=active]:bg-accent sm:text-sm"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
      {typeof count === "number" ? (
        <span className="rounded-full bg-muted px-1 text-[10px] tabular-nums leading-4 text-muted-foreground">
          {count}
        </span>
      ) : null}
    </TabsTrigger>
  );
}
