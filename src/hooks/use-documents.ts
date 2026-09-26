"use client";

/**
 * use-documents — данные модуля «Документы» (Фаза A):
 *  - useDocuments(workspaceId) — список документов воркспейса + CRUD списка;
 *  - useDocument(id) — полный документ с секциями + мутации секций
 *    (автосейв контента, статус, создание/удаление) с оптимистичным UI;
 *  - useDocumentShelves() — глобальный режим: воркспейсы с документами
 *    («полки»), чтобы экран из сайдбара студии показывал всё сразу.
 *
 * Простой паттерн useState+useEffect (как use-notes): без react-query.
 * Гонки запросов отсекаются seq-guard'ом; мутации патчат локальное
 * состояние оптимистично, ошибки откатывают снапшот и показывают toast.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { documentsAfterCreate } from "@/lib/documents-list";
import type {
  DocumentDto,
  DocumentKind,
  DocumentSectionDto,
  WorkspaceDto,
} from "@/lib/workspace-types";

/** Слова считаем так же, как бэкенд (workspace-shapes.wordsCount). */
export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/* ─────────────────── useDocuments — список воркспейса ─────────────────── */

const EMPTY_DOCS: DocumentDto[] = [];

export function useDocuments(workspaceId?: string | null) {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const seqRef = useRef(0);
  const documentsRef = useRef<DocumentDto[]>([]);
  const workspaceVersion = useAppUi((s) => s.workspaceVersion);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const fetchList = useCallback(async (seq: number, id: string) => {
    setLoading(true);
    try {
      const docs = await api.listDocuments(id);
      if (seq !== seqRef.current) return;
      setDocuments(docs);
      setLoadError(false);
    } catch {
      if (seq !== seqRef.current) return;
      setDocuments([]);
      setLoadError(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    if (workspaceId) void fetchList(seq, workspaceId);
  }, [workspaceId, fetchList, workspaceVersion]);

  // Без воркспейса — пустой список без запроса (селектор, не эффект).
  const list = workspaceId ? documents : EMPTY_DOCS;

  /** Создать документ (API) и поставить в начало списка. */
  const create = useCallback(
    async (body: { title: string; kind?: DocumentKind }) => {
      if (!workspaceId) throw new Error("Нет активного воркспейса");
      const doc = await api.createDocument(workspaceId, body);
      setDocuments((prev) => documentsAfterCreate(prev, doc));
      return doc;
    },
    [workspaceId],
  );

  /** Локальный патч пункта списка (синхронизация с useDocument). */
  const patchLocal = useCallback((id: string, patch: Partial<DocumentDto>) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)),
    );
  }, []);

  /** Переименовать (API + локальный патч; ошибка — откат). */
  const rename = useCallback(async (id: string, title: string) => {
    const snapshot = documentsRef.current;
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, title } : doc)),
    );
    try {
      return await api.updateDocument(id, { title });
    } catch {
      setDocuments(snapshot);
      toast.error("Не удалось переименовать документ");
      return null;
    }
  }, []);

  /** Удалить документ (оптимистично, с откатом). */
  const remove = useCallback(async (id: string) => {
    const snapshot = documentsRef.current;
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    try {
      await api.deleteDocument(id);
    } catch {
      setDocuments(snapshot);
      toast.error("Не удалось удалить документ");
      throw new Error("Не удалось удалить документ");
    }
  }, []);

  return {
    documents: list,
    loading: workspaceId ? loading : false,
    loadError,
    create,
    patchLocal,
    rename,
    remove,
  };
}

/* ─────────────────── useDocument — полный документ ─────────────────── */

export type SectionPatch = {
  title?: string;
  content?: string;
  status?: "draft" | "done";
};

export function useDocument(documentId?: string | null) {
  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [loadError, setLoadError] = useState(false);
  const seqRef = useRef(0);
  const documentRef = useRef<DocumentDto | null>(null);
  const saveSeqRef = useRef(new Map<string, number>());

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const fetchDoc = useCallback(async (seq: number, id: string) => {
    setLoading(true);
    try {
      const loaded = await api.getDocument(id);
      if (seq !== seqRef.current) return;
      setDocument(loaded);
      setLoadError(false);
    } catch {
      if (seq !== seqRef.current) return;
      setLoadError(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    if (documentId) void fetchDoc(seq, documentId);
  }, [documentId, fetchDoc]);

  function patchSectionLocal(id: string, patch: SectionPatch): void {
    setDocument((prev) => {
      if (!prev?.sections) return prev;
      const sections = prev.sections.map((section) =>
        section.id === id
          ? {
              ...section,
              ...patch,
              ...(patch.content !== undefined
                ? { wordsCount: countWords(patch.content) }
                : {}),
              updatedAt: new Date().toISOString(),
            }
          : section,
      );
      return {
        ...prev,
        sections,
        wordsCount: sections.reduce((acc, s) => acc + s.wordsCount, 0),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  /** Автосейв секции: оптимистичный патч + API; ошибка — откат и toast. */
  const saveSection = useCallback(async (id: string, patch: SectionPatch) => {
    const requestSeq = nextSaveSeq(saveSeqRef.current, id);
    const snapshot = documentRef.current;
    patchSectionLocal(id, patch);
    try {
      const section = await api.updateSection(id, patch);
      if (isStaleSectionSave(saveSeqRef.current, id, requestSeq)) {
        return section;
      }
      setDocument((prev) => {
        if (!prev?.sections) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === id ? section : s,
          ),
          wordsCount: prev.sections.reduce(
            (acc, s) => acc + (s.id === id ? section.wordsCount : s.wordsCount),
            0,
          ),
        };
      });
      return section;
    } catch {
      if (isStaleSectionSave(saveSeqRef.current, id, requestSeq)) {
        return null;
      }
      setDocument(snapshot);
      toast.error("Не удалось сохранить секцию", {
        description: "Проверьте соединение — правки остались в поле ввода.",
      });
      return null;
    }
  }, []);

  /** Добавить главу/раздел в конец (API возвращает секцию с order). */
  const createSection = useCallback(async (title: string) => {
    if (!documentId) throw new Error("Нет активного документа");
    const section = await api.createSection(documentId, title);
    setDocument((prev) => {
      if (!prev) return prev;
      const sections = [...(prev.sections ?? []), section];
      return {
        ...prev,
        sections,
        sectionsCount: sections.length,
        wordsCount: sections.reduce((acc, s) => acc + s.wordsCount, 0),
      };
    });
    return section;
  }, [documentId]);

  /** Удалить секцию (оптимистично, с откатом). */
  const deleteSection = useCallback(async (id: string) => {
    const snapshot = documentRef.current;
    setDocument((prev) => {
      if (!prev) return prev;
      const sections = (prev.sections ?? []).filter((s) => s.id !== id);
      return {
        ...prev,
        sections,
        sectionsCount: sections.length,
        wordsCount: sections.reduce((acc, s) => acc + s.wordsCount, 0),
      };
    });
    try {
      await api.deleteSection(id);
    } catch {
      setDocument(snapshot);
      toast.error("Не удалось удалить главу");
      throw new Error("Не удалось удалить главу");
    }
  }, []);

  /** Применить секцию, уже сохранённую на сервере (ИИ-правка). */
  const applySection = useCallback((section: DocumentSectionDto) => {
    setDocument((prev) => {
      if (!prev?.sections) return prev;
      const sections = prev.sections.map((s) =>
        s.id === section.id ? section : s,
      );
      return {
        ...prev,
        sections,
        wordsCount: sections.reduce((acc, s) => acc + s.wordsCount, 0),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  /** Переименовать документ (API + локальный патч). */
  const rename = useCallback(async (title: string) => {
    if (!documentId) return null;
    try {
      const doc = await api.updateDocument(documentId, { title });
      setDocument((prev) => (prev ? { ...prev, title } : prev));
      return doc;
    } catch {
      toast.error("Не удалось переименовать документ");
      return null;
    }
  }, [documentId]);

  return {
    document: documentId ? document : null,
    loading: documentId ? loading : false,
    loadError,
    saveSection,
    createSection,
    deleteSection,
    applySection,
    rename,
  };
}

/* ─────────────── useDocumentShelves — глобальный режим ─────────────── */

export interface DocShelf {
  workspace: WorkspaceDto;
  documents: DocumentDto[];
}

/** Все воркспейсы с counts.documents > 0 + их документы («полки»). */
export function useDocumentShelves() {
  const [shelves, setShelves] = useState<DocShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const workspaces = await api.listWorkspaces();
      const withDocs = workspaces.filter((ws) => ws.counts.documents > 0);
      const lists = await Promise.all(
        withDocs.map((ws) =>
          api.listDocuments(ws.id).catch(() => [] as DocumentDto[]),
        ),
      );
      setShelves(
        withDocs
          .map((workspace, index) => ({ workspace, documents: lists[index] }))
          .filter((shelf) => shelf.documents.length > 0),
      );
      setLoadError(false);
    } catch {
      setShelves([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Локальный патч документа внутри полки (синхронизация с редактором). */
  const patchDocument = useCallback((docId: string, patch: Partial<DocumentDto>) => {
    setShelves((prev) =>
      prev.map((shelf) => ({
        ...shelf,
        documents: shelf.documents.map((doc) =>
          doc.id === docId ? { ...doc, ...patch } : doc,
        ),
      })),
    );
  }, []);

  /** Локальное удаление документа из полок. */
  const removeDocument = useCallback((docId: string) => {
    setShelves((prev) =>
      prev
        .map((shelf) => ({
          ...shelf,
          documents: shelf.documents.filter((doc) => doc.id !== docId),
        }))
        .filter((shelf) => shelf.documents.length > 0),
    );
  }, []);

  /** Добавить созданный документ в полку его воркспейса. */
  const addDocument = useCallback((workspace: WorkspaceDto, doc: DocumentDto) => {
    setShelves((prev) => {
      const existing = prev.find((shelf) => shelf.workspace.id === workspace.id);
      if (existing) {
        return prev.map((shelf) =>
          shelf.workspace.id === workspace.id
            ? { ...shelf, documents: [doc, ...shelf.documents] }
            : shelf,
        );
      }
      return [...prev, { workspace, documents: [doc] }];
    });
  }, []);

  return { shelves, loading, loadError, refresh: load, patchDocument, removeDocument, addDocument };
}
