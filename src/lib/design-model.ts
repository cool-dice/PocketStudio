/** Raster / layout lite document stored as DesignDoc.payload JSON. */

export type DesignTool =
  | "move"
  | "brush"
  | "eraser"
  | "select"
  | "crop"
  | "text"
  | "shape"
  | "eyedropper";

export interface RasterLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  /** PNG data URL of this layer. */
  dataUrl: string;
}

export interface RasterDoc {
  kind: "raster";
  width: number;
  height: number;
  layers: RasterLayer[];
  activeLayerId: string;
  /** Фильтры от агента `apply_filter`, применяются при открытии холста. */
  pendingFilters?: Array<"bright" | "contrast" | "sat" | "bw">;
}

export interface LayoutFrame {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius: number;
  shadow: boolean;
  fontFamily: string;
  fontSize: number;
  text: string;
}

export interface LayoutDoc {
  kind: "layout";
  width: number;
  height: number;
  frames: LayoutFrame[];
  selectedId: string | null;
}

export type DesignPayload = RasterDoc | LayoutDoc;

export function emptyRaster(width = 800, height = 600): RasterDoc {
  const id = "layer-1";
  return {
    kind: "raster",
    width,
    height,
    activeLayerId: id,
    layers: [
      {
        id,
        name: "Слой 1",
        visible: true,
        opacity: 1,
        dataUrl: "",
      },
    ],
  };
}

export function emptyLayout(width = 800, height = 600): LayoutDoc {
  return {
    kind: "layout",
    width,
    height,
    selectedId: "frame-1",
    frames: [
      {
        id: "frame-1",
        name: "Фрейм 1",
        x: 40,
        y: 40,
        w: 320,
        h: 180,
        fill: "#ecfdf5",
        radius: 12,
        shadow: true,
        fontFamily: "Inter, sans-serif",
        fontSize: 18,
        text: "Заголовок",
      },
    ],
  };
}

function asSize(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(8192, Math.round(value))
    : fallback;
}

function normalizeRasterLayer(value: unknown): RasterLayer | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<RasterLayer>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (typeof raw.dataUrl !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    visible: raw.visible !== false,
    opacity:
      typeof raw.opacity === "number" && Number.isFinite(raw.opacity)
        ? Math.min(1, Math.max(0, raw.opacity))
        : 1,
    dataUrl: raw.dataUrl,
  };
}

function normalizeLayoutFrame(value: unknown): LayoutFrame | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<LayoutFrame>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    id: raw.id,
    name: raw.name,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(8, num(raw.w, 120)),
    h: Math.max(8, num(raw.h, 80)),
    fill: typeof raw.fill === "string" && raw.fill ? raw.fill : "#ffffff",
    radius: Math.max(0, num(raw.radius, 0)),
    shadow: Boolean(raw.shadow),
    fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : "Inter, sans-serif",
    fontSize: Math.max(8, num(raw.fontSize, 16)),
    text: typeof raw.text === "string" ? raw.text : "",
  };
}

const FILTER_KINDS = new Set(["bright", "contrast", "sat", "bw"]);

export function tryParseDesignPayload(raw: unknown): DesignPayload | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const doc = parsed as Partial<DesignPayload> & { pendingFilters?: unknown };
  if (doc.kind === "raster" && Array.isArray(doc.layers)) {
    const layers = doc.layers
      .map(normalizeRasterLayer)
      .filter((layer): layer is RasterLayer => Boolean(layer));
    const width = asSize(doc.width, 800);
    const height = asSize(doc.height, 600);
    const activeLayerId =
      typeof doc.activeLayerId === "string" && layers.some((l) => l.id === doc.activeLayerId)
        ? doc.activeLayerId
        : (layers[0]?.id ?? "");
    const pending = Array.isArray(doc.pendingFilters)
      ? doc.pendingFilters.filter(
          (item): item is NonNullable<RasterDoc["pendingFilters"]>[number] =>
            typeof item === "string" && FILTER_KINDS.has(item),
        )
      : undefined;
    return {
      kind: "raster",
      width,
      height,
      layers,
      activeLayerId,
      ...(pending && pending.length > 0 ? { pendingFilters: pending } : {}),
    };
  }
  if (doc.kind === "layout" && Array.isArray(doc.frames)) {
    const frames = doc.frames
      .map(normalizeLayoutFrame)
      .filter((frame): frame is LayoutFrame => Boolean(frame));
    const width = asSize(doc.width, 800);
    const height = asSize(doc.height, 600);
    const selectedId =
      typeof doc.selectedId === "string" && frames.some((f) => f.id === doc.selectedId)
        ? doc.selectedId
        : (frames[0]?.id ?? null);
    return { kind: "layout", width, height, frames, selectedId };
  }
  return null;
}

export function parseDesignPayload(
  raw: string,
  mode: "raster" | "layout",
): DesignPayload {
  return tryParseDesignPayload(raw) ?? (mode === "layout" ? emptyLayout() : emptyRaster());
}
