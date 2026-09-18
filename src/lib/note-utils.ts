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

/** Parsed recommendations list (DB stores a JSON string). */
export function parseRecommendations(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const items = parsed.filter((r): r is string => typeof r === "string");
      return items.length > 0 ? items : null;
    }
  } catch {
    // malformed legacy JSON → treat as absent
  }
  return null;
}

/**
 * Note as exposed in API responses (with nested category).
 * Stage 2 flat analysis fields (worklog Task 2-ctr):
 *   positive/negative/final mirror DB positiveBlock/negativeBlock/finalBlock,
 *   recommendations is a parsed string array.
 */
export type NoteShape = {
  id: string;
  rawText: string | null;
  status: string;
  favorite: boolean;
  createdAt: Date;
  updatedAt?: Date;
  transcription?: string | null;
  positive?: string | null;
  negative?: string | null;
  final?: string | null;
  recommendations?: string[] | null;
  analyzedAt?: Date | null;
  errorMessage?: string | null;
  category: CategoryShape | null;
};

/** DB note row (subset) accepted by noteWithCategory. */
export type NoteRow = {
  id: string;
  rawText: string | null;
  status: string;
  favorite: boolean;
  createdAt: Date;
  updatedAt?: Date;
  transcription?: string | null;
  positiveBlock?: string | null;
  negativeBlock?: string | null;
  finalBlock?: string | null;
  /** JSON string array from the DB. */
  recommendations?: string | null;
  analyzedAt?: Date | null;
  errorMessage?: string | null;
  category: CategoryShape | null;
};

/**
 * Shape a DB note row (with its category) for API responses:
 * {id, rawText, status, favorite, createdAt, updatedAt, transcription,
 *  positive, negative, final, recommendations: string[]|null, analyzedAt,
 *  errorMessage, category: {id,name,color,icon} | null}
 */
export function noteWithCategory(note: NoteRow): NoteShape {
  return {
    id: note.id,
    rawText: note.rawText,
    status: note.status,
    favorite: note.favorite,
    createdAt: note.createdAt,
    ...(note.updatedAt !== undefined ? { updatedAt: note.updatedAt } : {}),
    ...(note.transcription !== undefined ? { transcription: note.transcription } : {}),
    ...(note.positiveBlock !== undefined ? { positive: note.positiveBlock } : {}),
    ...(note.negativeBlock !== undefined ? { negative: note.negativeBlock } : {}),
    ...(note.finalBlock !== undefined ? { final: note.finalBlock } : {}),
    ...(note.recommendations !== undefined
      ? { recommendations: parseRecommendations(note.recommendations) }
      : {}),
    ...(note.analyzedAt !== undefined ? { analyzedAt: note.analyzedAt } : {}),
    ...(note.errorMessage !== undefined ? { errorMessage: note.errorMessage } : {}),
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
