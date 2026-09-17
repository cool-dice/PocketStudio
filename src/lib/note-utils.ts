// Shared notebook helpers: category allowlists + note response shaping.
// Client-safe module (no server-only imports).

/** Allowed Tailwind-ish color keys for categories. */
export const COLORS = [
  "emerald",
  "amber",
  "rose",
  "sky",
  "violet",
  "stone",
  "teal",
  "orange",
  "pink",
  "cyan",
] as const;

export type CategoryColor = (typeof COLORS)[number];

/** Allowed lucide icon names for categories. */
export const ICONS = [
  "lightbulb",
  "briefcase",
  "shopping-cart",
  "heart",
  "brain",
  "zap",
  "star",
  "book",
  "code",
  "rocket",
  "wallet",
  "coffee",
] as const;

export type CategoryIcon = (typeof ICONS)[number];

export function isCategoryColor(value: string): value is CategoryColor {
  return (COLORS as readonly string[]).includes(value);
}

export function isCategoryIcon(value: string): value is CategoryIcon {
  return (ICONS as readonly string[]).includes(value);
}

/** Category subset exposed in API responses. */
export type CategoryShape = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

/** Note as exposed in API responses (with nested category). */
export type NoteShape = {
  id: string;
  rawText: string | null;
  status: string;
  favorite: boolean;
  createdAt: Date;
  category: CategoryShape | null;
};

/**
 * Shape a note (with its category) for API responses:
 * {id, rawText, status, favorite, createdAt, category: {id,name,color,icon} | null}
 */
export function noteWithCategory(note: NoteShape): NoteShape {
  return {
    id: note.id,
    rawText: note.rawText,
    status: note.status,
    favorite: note.favorite,
    createdAt: note.createdAt,
    category: note.category
      ? {
          id: note.category.id,
          name: note.category.name,
          color: note.category.color,
          icon: note.category.icon,
        }
      : null,
  };
}
