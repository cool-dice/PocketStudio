"use client";

/**
 * Manage own note categories and tags. Mutations toast only after the API;
 * empty lists are not load errors; a failed load is not «пока нет».
 * Category color/icon go through the same POST/PATCH as the name.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import {
  CategoryGlyph,
  categoryColorStyle,
} from "@/lib/category-style";
import {
  CATEGORY_COLOR_KEYS,
  CATEGORY_DEFAULT_COLOR,
  CATEGORY_DEFAULT_ICON,
  CATEGORY_DELETE_CONFIRM,
  CATEGORY_DELETE_CONFIRM_HINT,
  CATEGORY_ICON_KEYS,
  TAG_DELETE_CONFIRM,
  TAG_DELETE_CONFIRM_HINT,
  TAXONOMY_CANCEL,
  TAXONOMY_COLOR,
  TAXONOMY_CREATE,
  TAXONOMY_DELETE,
  TAXONOMY_DIALOG_HINT,
  TAXONOMY_DIALOG_TITLE,
  TAXONOMY_ICON,
  TAXONOMY_RENAME,
  TAXONOMY_RETRY,
  TAXONOMY_SAVE,
  categoryStylePayload,
  parseCategoryColor,
  parseCategoryIcon,
  taxonomyAfterCreate,
  taxonomyAfterDelete,
  taxonomyCategoryPatched,
  taxonomyEmptyCopy,
  taxonomyListView,
  taxonomyLoadErrorCopy,
  taxonomyRenamed,
  taxonomyToast,
  validateCategoryName,
  validateTagName,
  type TaxonomyKind,
} from "@/lib/notebook-taxonomy";
import type { CategoryColor, CategoryIcon } from "@/lib/note-utils";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  noteCount: number;
  color?: string;
  icon?: string;
};

export function NotebookTaxonomyDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (kind: TaxonomyKind, deletedId?: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{TAXONOMY_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{TAXONOMY_DIALOG_HINT}</DialogDescription>
        </DialogHeader>
        {open ? (
          <div className="space-y-6">
            <TaxonomySection kind="category" onChanged={onChanged} />
            <TaxonomySection kind="tag" onChanged={onChanged} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryStylePicker({
  color,
  icon,
  disabled,
  onColor,
  onIcon,
}: {
  color: CategoryColor;
  icon: CategoryIcon;
  disabled?: boolean;
  onColor: (color: CategoryColor) => void;
  onIcon: (icon: CategoryIcon) => void;
}) {
  return (
    <div className="space-y-2">
      <div role="group" aria-label={TAXONOMY_COLOR}>
        <p className="mb-1 text-xs text-muted-foreground">{TAXONOMY_COLOR}</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_COLOR_KEYS.map((key) => {
            const selected = color === key;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-label={`${TAXONOMY_COLOR} ${key}`}
                aria-pressed={selected}
                className={cn(
                  "size-6 rounded-full border border-transparent",
                  categoryColorStyle(key).dot,
                  selected && "ring-2 ring-offset-1 ring-foreground",
                  disabled && "opacity-50",
                )}
                onClick={() => onColor(key)}
              />
            );
          })}
        </div>
      </div>
      <div role="group" aria-label={TAXONOMY_ICON}>
        <p className="mb-1 text-xs text-muted-foreground">{TAXONOMY_ICON}</p>
        <div className="flex flex-wrap gap-1">
          {CATEGORY_ICON_KEYS.map((key) => {
            const selected = icon === key;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-label={`${TAXONOMY_ICON} ${key}`}
                aria-pressed={selected}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md border",
                  selected
                    ? "border-foreground bg-muted"
                    : "border-transparent hover:bg-muted/60",
                  disabled && "opacity-50",
                )}
                onClick={() => onIcon(key)}
              >
                <CategoryGlyph icon={key} className="size-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaxonomySection({
  kind,
  onChanged,
}: {
  kind: TaxonomyKind;
  onChanged?: (kind: TaxonomyKind, deletedId?: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftColor, setDraftColor] = useState<CategoryColor>(CATEGORY_DEFAULT_COLOR);
  const [draftIcon, setDraftIcon] = useState<CategoryIcon>(CATEGORY_DEFAULT_ICON);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editColor, setEditColor] = useState<CategoryColor>(CATEGORY_DEFAULT_COLOR);
  const [editIcon, setEditIcon] = useState<CategoryIcon>(CATEGORY_DEFAULT_ICON);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list =
        kind === "category" ? await api.listCategories() : await api.listTags();
      setRows(list);
    } catch {
      setRows([]);
      setLoadError(taxonomyLoadErrorCopy(kind).title);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = taxonomyListView(loading, loadError, rows.length);
  const empty = taxonomyEmptyCopy(kind);
  const errorCopy = taxonomyLoadErrorCopy(kind);
  const heading = kind === "category" ? "Категории" : "Теги";
  const placeholder = kind === "category" ? "Название категории" : "Название тега";

  async function createRow() {
    const parsed =
      kind === "category" ? validateCategoryName(draft) : validateTagName(draft);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const style = categoryStylePayload(draftColor, draftIcon);
      const created =
        kind === "category"
          ? await api.createCategory({ name: parsed.name, ...style })
          : await api.createTag({ name: parsed.name });
      setRows((prev) => taxonomyAfterCreate(prev, created, true));
      setDraft("");
      setDraftColor(CATEGORY_DEFAULT_COLOR);
      setDraftIcon(CATEGORY_DEFAULT_ICON);
      toast.success(taxonomyToast(true, kind, "create").message);
      onChanged?.(kind);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : taxonomyToast(false, kind, "create").message;
      setFieldError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function saveRow(id: string) {
    const previous = rows.find((r) => r.id === id);
    const parsed =
      kind === "category"
        ? validateCategoryName(editDraft)
        : validateTagName(editDraft);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      if (kind === "category") {
        const style = categoryStylePayload(editColor, editIcon);
        const updated = await api.updateCategory(id, {
          name: parsed.name,
          ...style,
        });
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? taxonomyCategoryPatched(
                  true,
                  {
                    ...r,
                    color: r.color ?? CATEGORY_DEFAULT_COLOR,
                    icon: r.icon ?? CATEGORY_DEFAULT_ICON,
                  },
                  updated,
                )
              : r,
          ),
        );
        toast.success(taxonomyToast(true, "category", "update").message);
      } else {
        const updated = await api.updateTag(id, { name: parsed.name });
        setRows((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, name: taxonomyRenamed(true, previous?.name ?? editDraft, updated.name) }
              : r,
          ),
        );
        toast.success(taxonomyToast(true, "tag", "rename").message);
      }
      setEditingId(null);
      onChanged?.(kind);
    } catch (err) {
      const op = kind === "category" ? "update" : "rename";
      const message =
        err instanceof ApiError ? err.message : taxonomyToast(false, kind, op).message;
      setFieldError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setBusy(true);
    try {
      if (kind === "category") await api.deleteCategory(id);
      else await api.deleteTag(id);
      setRows((prev) => taxonomyAfterDelete(prev, id, true));
      toast.success(taxonomyToast(true, kind, "delete").message);
      onChanged?.(kind, id);
    } catch {
      toast.error(taxonomyToast(false, kind, "delete").message);
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <section className="space-y-3" aria-label={heading}>
      <h3 className="text-sm font-medium">{heading}</h3>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void createRow();
        }}
      >
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder={placeholder}
            disabled={busy}
            aria-invalid={Boolean(fieldError)}
            aria-label={placeholder}
          />
          <Button type="submit" size="sm" className="shrink-0" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {TAXONOMY_CREATE}
          </Button>
        </div>
        {kind === "category" ? (
          <CategoryStylePicker
            color={draftColor}
            icon={draftIcon}
            disabled={busy}
            onColor={setDraftColor}
            onIcon={setDraftIcon}
          />
        ) : null}
      </form>
      {fieldError ? (
        <p className="text-xs text-destructive">{fieldError}</p>
      ) : null}

      {view === "loading" ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : view === "error" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{errorCopy.title}</p>
          <p className="mt-1 text-muted-foreground">{errorCopy.hint}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            {TAXONOMY_RETRY}
          </Button>
        </div>
      ) : view === "empty" ? (
        <p className="text-sm text-muted-foreground">
          {empty.title}. {empty.hint}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={row.id} className="space-y-2 px-3 py-2">
              <div className="flex items-center gap-2">
                {kind === "category" && editingId !== row.id ? (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        categoryColorStyle(row.color ?? CATEGORY_DEFAULT_COLOR).dot,
                      )}
                    />
                    <CategoryGlyph
                      icon={row.icon ?? CATEGORY_DEFAULT_ICON}
                      className="size-3.5 shrink-0"
                    />
                  </>
                ) : null}
                {editingId === row.id ? (
                  <Input
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveRow(row.id);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    disabled={busy}
                    className="h-8"
                    aria-label={kind === "category" ? TAXONOMY_SAVE : TAXONOMY_RENAME}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {row.name}
                    <span className="ml-2 text-muted-foreground">{row.noteCount}</span>
                  </span>
                )}
                {editingId === row.id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void saveRow(row.id)}
                  >
                    {kind === "category" ? TAXONOMY_SAVE : TAXONOMY_RENAME}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={busy}
                    aria-label={`${kind === "category" ? TAXONOMY_SAVE : TAXONOMY_RENAME} «${row.name}»`}
                    onClick={() => {
                      setEditingId(row.id);
                      setEditDraft(row.name);
                      setEditColor(parseCategoryColor(row.color));
                      setEditIcon(parseCategoryIcon(row.icon));
                      setFieldError(null);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  disabled={busy}
                  aria-label={`${TAXONOMY_DELETE} «${row.name}»`}
                  onClick={() => setDeleteTarget(row)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              {kind === "category" && editingId === row.id ? (
                <CategoryStylePicker
                  color={editColor}
                  icon={editIcon}
                  disabled={busy}
                  onColor={setEditColor}
                  onIcon={setEditIcon}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {kind === "category" ? CATEGORY_DELETE_CONFIRM : TAG_DELETE_CONFIRM}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "category"
                ? CATEGORY_DELETE_CONFIRM_HINT
                : TAG_DELETE_CONFIRM_HINT}{" "}
              «{deleteTarget?.name}».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{TAXONOMY_CANCEL}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {TAXONOMY_DELETE}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
