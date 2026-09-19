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

export function parseDesignPayload(
  raw: string,
  mode: "raster" | "layout",
): DesignPayload {
  try {
    const parsed = JSON.parse(raw) as Partial<DesignPayload>;
    if (parsed && parsed.kind === "raster" && Array.isArray(parsed.layers)) {
      return parsed as RasterDoc;
    }
    if (parsed && parsed.kind === "layout" && Array.isArray(parsed.frames)) {
      return parsed as LayoutDoc;
    }
  } catch {
    // fall through
  }
  return mode === "layout" ? emptyLayout() : emptyRaster();
}
