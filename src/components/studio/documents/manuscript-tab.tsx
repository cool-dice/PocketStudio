"use client";

/**
 * Вкладка «Рукопись» (Фаза A): трёхпанельный редактор на живых данных.
 * Слева — библиотека документов (в глобальном режиме — «полки» воркспейсов),
 * в центре — редактор с автосохранением (дебаунс 800 мс, индикатор в
 * тулбаре, живой счётчик слов), справа — дерево структуры и ИИ-помощник.
 */

import { BookOpenText } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DocumentDto, DocumentSectionDto } from "@/lib/workspace-types";
import type { DocShelf, SectionPatch } from "@/hooks/use-documents";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { ChapterTree } from "./chapter-tree";
import { DocChipsBar, DocumentLibrary } from "./doc-library";
import {
  DocumentTitleRow,
  EditorFooterStats,
  EditorPage,
  EditorSkeleton,
  NoDocumentsEmpty,
  useSectionAutosave,
} from "./editor-page";
import { EditorToolbar } from "./editor-toolbar";
import { SectionHistorySheet } from "./section-history-sheet";
import { countWords } from "@/hooks/use-documents";

export interface ManuscriptTabProps {
  /** Загрузка библиотеки. */
  loading: boolean;
  /** Плоский список документов (библиотека + мобильные чипы). */
  docs: DocumentDto[];
  /** Глобальный режим: группировка по воркспейсам (null — обычный режим). */
  shelves: DocShelf[] | null;
  activeDocId: string | null;
  /** Полный документ с секциями (из useDocument). */
  doc: DocumentDto | null;
  docLoading: boolean;
  onSelectDoc: (id: string) => void;
  onRemoveDoc: (id: string) => void;
  onRenameDoc: (id: string, title: string) => void;
  /** Открывает диалог «Новый документ» на уровне экрана. */
  onCreateDoc: () => void;
  saveSection: (id: string, patch: SectionPatch) => Promise<DocumentSectionDto | null>;
  createSection: (title: string) => Promise<DocumentSectionDto>;
  deleteSection: (id: string) => Promise<void>;
  onDocPatched: (docId: string, patch: Partial<DocumentDto>) => void;
}

export function ManuscriptTab(props: ManuscriptTabProps) {
  const {
    loading,
    docs,
    shelves,
    activeDocId,
    doc,
    docLoading,
    onSelectDoc,
    onRemoveDoc,
    onRenameDoc,
    onCreateDoc,
    saveSection,
    createSection,
    deleteSection,
    onDocPatched,
  } = props;

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const sections = doc?.sections ?? [];
  // Выбор главы — производное значение: пока не выбрали (или выбрали
  // удалённую) — первая секция документа. Эффект не нужен.
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null,
    [sections, activeSectionId],
  );

  // Синхронизация свежести в списке после сохранения секции.
  const handleSaveSection = useCallback(
    async (id: string, patch: SectionPatch) => {
      const result = await saveSection(id, patch);
      if (result && doc) {
        onDocPatched(doc.id, { updatedAt: new Date().toISOString() });
      }
      return result;
    },
    [saveSection, doc, onDocPatched],
  );

  const { draft, onChange, saveState, savedLabel } = useSectionAutosave(activeSection, handleSaveSection);

  async function handleCreateSection(title: string) {
    const section = await createSection(title);
    if (doc) {
      onDocPatched(doc.id, { updatedAt: new Date().toISOString() });
    }
    return section;
  }

  async function handleDeleteSection(id: string) {
    await deleteSection(id);
    if (doc) {
      onDocPatched(doc.id, { updatedAt: new Date().toISOString() });
    }
    if (activeSectionId === id) setActiveSectionId(null);
  }

  function handleToggleStatus(section: DocumentSectionDto) {
    void handleSaveSection(section.id, {
      status: section.status === "done" ? "draft" : "done",
    });
  }

  // Восстановление из истории: обновить локальное состояние и драфт поля
  // (PATCH-ноуп в БД не создаёт дубль-снапшот — текст уже идентичен).
  function handleRestored(section: DocumentSectionDto) {
    void handleSaveSection(section.id, { content: section.content });
    onChange(section.content);
  }

  const draftWords = useMemo(() => countWords(draft), [draft]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Слева: библиотека документов (lg+) */}
      <nav
        aria-label="Библиотека документов"
        className="hidden w-64 shrink-0 flex-col border-r bg-background lg:flex"
      >
        <DocumentLibrary
          docs={shelves ? undefined : docs}
          shelves={shelves ?? undefined}
          activeId={activeDocId}
          onSelect={onSelectDoc}
          onRemove={onRemoveDoc}
          loading={loading}
        />
      </nav>

      {/* Центр: редактор */}
      <main aria-label="Редактор документа" className="flex min-w-0 flex-1 flex-col bg-card">
        <DocChipsBar docs={docs} activeId={activeDocId} onSelect={onSelectDoc} />
        {doc ? (
          <DocumentTitleRow
            key={doc.id}
            doc={doc}
            onRename={(title) => onRenameDoc(doc.id, title)}
          />
        ) : null}
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
          {docLoading && !doc ? (
            <EditorSkeleton />
          ) : doc ? (
            <>
              <EditorToolbar
                textareaRef={textareaRef}
                onValueChange={onChange}
                saveState={saveState}
                savedLabel={savedLabel}
                sectionStatus={activeSection?.status ?? null}
                onToggleStatus={() =>
                  activeSection ? handleToggleStatus(activeSection) : undefined
                }
                onOpenHistory={() => setHistoryOpen(true)}
                disabled={!activeSection}
              />
              <EditorPage
                key={doc.id}
                doc={doc}
                section={activeSection}
                draft={draft}
                onChange={onChange}
                textareaRef={textareaRef}
              />
            </>
          ) : docs.length > 0 || loading ? (
            <div className="flex min-h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <BookOpenText className="size-6" />
              </span>
              <p className="text-sm font-medium">Выберите документ в библиотеке</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Слева — документы этого воркспейса. На мобильном — лента сверху.
              </p>
            </div>
          ) : (
            <NoDocumentsEmpty onCreate={onCreateDoc} />
          )}
        </div>
        {doc ? (
          <EditorFooterStats doc={doc} section={activeSection} draftWords={draftWords} />
        ) : null}

        {/* История версий главы (PS-6) */}
        <SectionHistorySheet
          section={activeSection}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onRestored={handleRestored}
        />
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
            {doc ? (
              <ChapterTree
                doc={doc}
                currentId={activeSection?.id ?? null}
                onSelect={setActiveSectionId}
                onCreateSection={handleCreateSection}
                onRenameSection={(id, title) => void handleSaveSection(id, { title })}
                onToggleStatus={handleToggleStatus}
                onDeleteSection={handleDeleteSection}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
                Выберите документ — структура появится здесь.
              </div>
            )}
          </TabsContent>
          <TabsContent value="ai" className="flex min-h-0 flex-1 flex-col">
            <AiAssistantPanel />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
