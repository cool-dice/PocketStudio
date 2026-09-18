"use client";

/**
 * Документы — модуль писательской студии.
 * Три зоны: библиотека слева (lg+), редактор в центре,
 * структура и ИИ-помощник справа (xl+). Чистый визуальный слой:
 * выбор документа и главы — локальное состояние, текст статичен.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ChevronDown,
  Clapperboard,
  ListPlus,
  Newspaper,
  Plus,
  Save,
} from "lucide-react";
import { useState } from "react";

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
import { AiAssistantPanel } from "./ai-assistant-panel";
import { ChapterTree, ChapterTreeEmpty } from "./chapter-tree";
import { DocChipsBar, DocumentLibrary } from "./doc-library";
import { DocumentTitleRow, EditorFooterStats, EditorPage } from "./editor-page";
import { EditorToolbar } from "./editor-toolbar";
import { MOCK_DOCS } from "./types";

const NEW_DOC_ITEMS: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: BookOpenText, label: "Книга", hint: "роман или нон-фикшн с главами" },
  { icon: Newspaper, label: "Статья", hint: "пост, колонка или гайд" },
  { icon: Clapperboard, label: "Сценарий", hint: "сцены, реплики, раскадровка" },
  { icon: ListPlus, label: "Глава", hint: "добавить в текущую книгу" },
];

export function DocumentsScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [activeDocId, setActiveDocId] = useState(MOCK_DOCS[0].id);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    MOCK_DOCS[0].chapters?.find((chapter) => chapter.status === "current")?.id ?? null,
  );

  const activeDoc = MOCK_DOCS.find((doc) => doc.id === activeDocId) ?? MOCK_DOCS[0];
  const activeChapter = activeDoc.chapters?.find((chapter) => chapter.id === activeChapterId) ?? null;

  function handleSelectDoc(id: string) {
    setActiveDocId(id);
    const doc = MOCK_DOCS.find((item) => item.id === id);
    setActiveChapterId(doc?.chapters?.find((chapter) => chapter.status === "current")?.id ?? null);
  }

  return (
    <section aria-label="Документы" className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <ModuleHeader
        icon={BookOpenText}
        title="Документы"
        description="Книги, статьи и сценарии — от черновика до публикации"
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
    </section>
  );
}
