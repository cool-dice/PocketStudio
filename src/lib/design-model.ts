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
  const doc = parsed as Partial<DesignPayload>;
  if (doc.kind === "raster" && Array.isArray(doc.layers)) {
    const layers = doc.layers.filter(
      (layer): layer is RasterLayer =>
        Boolean(layer) &&
        typeof layer.id === "string" &&
        typeof layer.name === "string" &&
        typeof layer.dataUrl === "string",
    );
    if (layers.length === 0) return null;
    const width = typeof doc.width === "number" && doc.width > 0 ? doc.width : 800;
    const height = typeof doc.height === "number" && doc.height > 0 ? doc.height : 600;
    const activeLayerId =
      typeof doc.activeLayerId === "string" && layers.some((l) => l.id === doc.activeLayerId)
        ? doc.activeLayerId
        : layers[0]!.id;
    return { kind: "raster", width, height, layers, activeLayerId };
  }
  if (doc.kind === "layout" && Array.isArray(doc.frames)) {
    const frames = doc.frames.filter(
      (frame): frame is LayoutFrame =>
        Boolean(frame) && typeof frame.id === "string" && typeof frame.name === "string",
    );
    if (frames.length === 0) return null;
    const width = typeof doc.width === "number" && doc.width > 0 ? doc.width : 800;
    const height = typeof doc.height === "number" && doc.height > 0 ? doc.height : 600;
    const selectedId =
      typeof doc.selectedId === "string" && frames.some((f) => f.id === doc.selectedId)
        ? doc.selectedId
        : frames[0]!.id;
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
