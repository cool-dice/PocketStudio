"use client";

/**
 * Документы → NarrativeCore (Фаза A, живой REST API). Оболочка модуля:
 * шапка с «Новым документом», вкладки Рукопись / Сущности / Альбом /
 * Аналитик. Встроенный режим (workspaceId) — документы одного воркспейса;
 * глобальный (сайдбар студии) — «полки» всех воркспейсов с документами.
 * Счётчики вкладок живые: табы репортят свои counts наверх.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ChevronDown,
  FileText,
  ImageIcon,
  Plus,
  ScanSearch,
  Shapes,
} from "lucide-react";
import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleHeader, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import {
  readLastWorkspaceDoc,
  writeLastWorkspaceDoc,
} from "@/lib/last-workspace-doc";
import type { DocumentDto, DocumentKind, WorkspaceDto } from "@/lib/workspace-types";
import { useDocument, useDocuments, useDocumentShelves } from "@/hooks/use-documents";
import { AlbumTab } from "./album-tab";
import { AnalystTab } from "./analyst-tab";
import { EntitiesTab } from "./entities-tab";
import { ManuscriptTab } from "./manuscript-tab";
import { DOC_KIND_META, DOC_KIND_FILTERS } from "./types";
import { SelectableChip } from "./narrative-chip";

type ModuleTab = "manuscript" | "entities" | "album" | "analyst";

interface TabCounts {
  entities: number | null;
  album: number | null;
  analyst: number | null;
}

export function DocumentsScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const [tab, setTab] = useState<ModuleTab>("manuscript");
  const [focusEntityId, setFocusEntityId] = useState<string | null>(null);
  const workspaceDocId = useAppUi((s) => s.workspaceDocId);
  const setWorkspaceDocId = useAppUi((s) => s.setWorkspaceDocId);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    () =>
      workspaceDocId ??
      (workspaceId ? readLastWorkspaceDoc(workspaceId) : null),
  );
  const [createOpen, setCreateOpen] = useState(false);

  const embedded = useDocuments(workspaceId ?? null);
  const globalShelves = useDocumentShelves();
  const isEmbedded = Boolean(workspaceId);

  const docs = useMemo(
    () =>
      isEmbedded
        ? embedded.documents
        : globalShelves.shelves.flatMap((shelf) => shelf.documents),
    [isEmbedded, embedded.documents, globalShelves.shelves],
  );
  const loading = isEmbedded ? embedded.loading : globalShelves.loading;
  const shelves = isEmbedded ? null : globalShelves.shelves;

  // Активный документ — производное значение: пока не выбрали (или
  // выбранный исчез после удаления) — первый в списке.
  const activeId = docs.some((candidate) => candidate.id === activeDocId)
    ? activeDocId
    : (docs[0]?.id ?? null);

  const {
    document: doc,
    loading: docLoading,
    saveSection,
    createSection,
    deleteSection,
    applySection,
    rename,
  } = useDocument(activeId);

  useEffect(() => {
    if (workspaceDocId && workspaceDocId !== activeDocId) {
      setActiveDocId(workspaceDocId);
    }
  }, [workspaceDocId, activeDocId]);

  useEffect(() => {
    if (!workspaceId || !activeId) return;
    writeLastWorkspaceDoc(workspaceId, activeId);
    if (workspaceDocId !== activeId) setWorkspaceDocId(activeId);
  }, [workspaceId, activeId, workspaceDocId, setWorkspaceDocId]);

  // Воркспейс данных для вкладок Сущности/Альбом/Аналитик.
  const dataWorkspaceId = isEmbedded
    ? workspaceId!
    : (docs.find((candidate) => candidate.id === activeId)?.projectId ??
      shelves?.[0]?.workspace.id ??
      null);
  const dataWorkspace: WorkspaceDto | null = isEmbedded
    ? null
    : (shelves?.find((shelf) => shelf.workspace.id === dataWorkspaceId)?.workspace ?? null);

  const analystDocs = useMemo(
    () => docs.filter((candidate) => candidate.projectId === dataWorkspaceId),
    [docs, dataWorkspaceId],
  );

  /* ── Счётчики вкладок (по воркспейсу, стабильные колбэки — без петель) ── */

  const [countsByWs, setCountsByWs] = useState<Record<string, TabCounts>>({});
  const wsRef = useRef(dataWorkspaceId ?? "");
  useEffect(() => {
    wsRef.current = dataWorkspaceId ?? "";
  }, [dataWorkspaceId]);
  const counts =
    countsByWs[dataWorkspaceId ?? ""] ?? { entities: null, album: null, analyst: null };

  const handleEntitiesCount = useCallback((n: number) => {
    setCountsByWs((prev) => {
      const key = wsRef.current;
      const current = prev[key] ?? { entities: null, album: null, analyst: null };
      if (current.entities === n) return prev;
      return { ...prev, [key]: { ...current, entities: n } };
    });
  }, []);
  const handleAlbumCount = useCallback((n: number) => {
    setCountsByWs((prev) => {
      const key = wsRef.current;
      const current = prev[key] ?? { entities: null, album: null, analyst: null };
      if (current.album === n) return prev;
      return { ...prev, [key]: { ...current, album: n } };
    });
  }, []);
  const handleAnalystCount = useCallback((n: number) => {
    setCountsByWs((prev) => {
      const key = wsRef.current;
      const current = prev[key] ?? { entities: null, album: null, analyst: null };
      if (current.analyst === n) return prev;
      return { ...prev, [key]: { ...current, analyst: n } };
    });
  }, []);

  /* ── Действия с документами ── */

  function handleSelectDoc(id: string) {
    setActiveDocId(id);
    if (workspaceId) {
      setWorkspaceDocId(id);
      writeLastWorkspaceDoc(workspaceId, id);
    }
  }

  async function handleRenameDoc(id: string, title: string) {
    if (id === activeDocId) {
      await rename(title);
    }
    if (isEmbedded) embedded.patchLocal(id, { title });
    else globalShelves.patchDocument(id, { title });
  }

  async function handleRemoveDoc(id: string) {
    try {
      if (isEmbedded) await embedded.remove(id);
      else await api.deleteDocument(id);
      globalShelves.removeDocument(id);
      if (id === activeDocId) setActiveDocId(null);
      toast.success("Документ удалён");
    } catch {
      /* toast уже показан в хуке */
    }
  }

  async function handleCreateDoc(title: string, kind: DocumentKind) {
    if (!dataWorkspaceId) return;
    try {
      const created = await api.createDocument(dataWorkspaceId, { title, kind });
      if (isEmbedded) embedded.patchLocal(created.id, created);
      else if (dataWorkspace) globalShelves.addDocument(dataWorkspace, created);
      setActiveDocId(created.id);
      setCreateOpen(false);
      setTab("manuscript");
      toast.success("Документ создан", {
        description: `«${created.title}» — первая глава уже внутри.`,
      });
    } catch {
      toast.error("Не удалось создать документ");
    }
  }

  function handleTabChange(value: string) {
    setTab(value as ModuleTab);
    if (value !== "entities") setFocusEntityId(null);
  }

  function handleOpenEntity(entityId: string) {
    setFocusEntityId(entityId);
    setTab("entities");
  }

  const libraryDocs = useMemo(
    () => (isEmbedded ? docs : shelves!.flatMap((shelf) => shelf.documents)),
    [isEmbedded, docs, shelves],
  );

  return (
    <section
      aria-label="Документы"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={BookOpenText}
        title="Документы"
        description={
          isEmbedded
            ? "Рукопись, сущности, альбом и аналитик — всё живьём из базы"
            : "Полки всех воркспейсов: рукописи, сущности, альбомы и аналитика"
        }
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button
          type="button"
          disabled={!dataWorkspaceId}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Новый документ
          <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
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
              count={counts.entities ?? undefined}
            />
            <TabTrigger
              icon={ImageIcon}
              value="album"
              label="Альбом"
              count={counts.album ?? undefined}
            />
            <TabTrigger
              icon={ScanSearch}
              value="analyst"
              label="Аналитик"
              count={counts.analyst ?? undefined}
            />
          </TabsList>
        </div>

        <TabsContent value="manuscript" className="flex min-h-0 flex-1 flex-col">
          <ManuscriptTab
            loading={loading}
            docs={libraryDocs}
            shelves={shelves}
            activeDocId={activeId}
            doc={doc}
            docLoading={docLoading}
            onSelectDoc={handleSelectDoc}
            onRemoveDoc={handleRemoveDoc}
            onRenameDoc={handleRenameDoc}
            onCreateDoc={() => setCreateOpen(true)}
            saveSection={saveSection}
            createSection={createSection}
            deleteSection={deleteSection}
            applySection={applySection}
            onDocPatched={(docId, patch) => {
              if (isEmbedded) embedded.patchLocal(docId, patch);
              else globalShelves.patchDocument(docId, patch);
            }}
            workspaceId={dataWorkspaceId}
          />
        </TabsContent>

        <TabsContent value="entities" className="flex min-h-0 flex-1 flex-col">
          <EntitiesTab
            workspaceId={dataWorkspaceId}
            focusEntityId={focusEntityId}
            onCountChange={handleEntitiesCount}
          />
        </TabsContent>

        <TabsContent value="album" className="flex min-h-0 flex-1 flex-col">
          <AlbumTab
            workspaceId={dataWorkspaceId}
            onOpenEntity={handleOpenEntity}
            onCountChange={handleAlbumCount}
          />
        </TabsContent>

        <TabsContent value="analyst" className="flex min-h-0 flex-1 flex-col">
          <AnalystTab
            workspaceId={dataWorkspaceId}
            documents={analystDocs}
            onCountChange={handleAnalystCount}
          />
        </TabsContent>
      </Tabs>

      {/* Диалог «Новый документ» */}
      <NewDocumentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreateDoc}
        workspaceName={isEmbedded ? null : (dataWorkspace?.name ?? null)}
      />
    </section>
  );
}

function NewDocumentDialog({
  open,
  onOpenChange,
  onCreate,
  workspaceName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, kind: DocumentKind) => Promise<void>;
  workspaceName: string | null;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<DocumentKind>("manuscript");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onCreate(trimmed, kind);
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый документ</DialogTitle>
          <DialogDescription>
            {workspaceName
              ? `Будет создан в воркспейсе «${workspaceName}».`
              : "Первая глава появится сразу — начинайте писать."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Название
            </p>
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Хроники Долгой Зимы — том второй"
              aria-label="Название документа"
              maxLength={120}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Тип
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DOC_KIND_FILTERS.map((kindId) => {
                const meta = DOC_KIND_META[kindId];
                return (
                  <SelectableChip
                    key={kindId}
                    label={meta.label}
                    icon={meta.icon}
                    selected={kind === kindId}
                    onClick={() => setKind(kindId)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" onClick={submit} disabled={!title.trim() || busy}>
            {busy ? (
              <FileText className="size-4 animate-pulse" aria-hidden="true" />
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
