import { describe, expect, test } from "bun:test";

import {
  emptyLayout,
  emptyRaster,
  designPreviewUrl,
  parseDesignPayload,
  tryParseDesignPayload,
} from "./design-model";
import {
  EMPTY_TIMELINE_COMPILE_ERROR,
  emptyTimeline,
  isExplicitEmptyCompileClips,
  parseTimeline,
  timelineHasRenderableClips,
  tryParseTimeline,
} from "./nle-model";
import {
  dawHasAudibleContent,
  defaultDawState,
  EMPTY_DAW_EXPORT_ERROR,
  normalizeDawState,
} from "./daw-model";

describe("design payload", () => {
  test("rejects garbage instead of silently becoming an empty canvas", () => {
    expect(tryParseDesignPayload("{not json")).toBeNull();
    expect(tryParseDesignPayload({ hello: 1 })).toBeNull();
    expect(tryParseDesignPayload({ kind: "raster" })).toBeNull();
  });

  test("empty canvas (blank layer dataUrl) is valid to save", () => {
    const seed = emptyRaster();
    const parsed = tryParseDesignPayload(seed);
    expect(parsed?.kind).toBe("raster");
    expect(parsed && parsed.kind === "raster" && parsed.layers[0]?.dataUrl).toBe("");
  });

  test("preview URL is omitted when the PNG data-URL is over the cap", () => {
    expect(designPreviewUrl("")).toBeNull();
    expect(designPreviewUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(designPreviewUrl(`data:image/png;base64,${"x".repeat(1_800_001)}`)).toBeNull();
  });

  test("empty layers array is still a valid empty canvas", () => {
    const parsed = tryParseDesignPayload({
      kind: "raster",
      width: 800,
      height: 600,
      layers: [],
      activeLayerId: "",
    });
    expect(parsed?.kind).toBe("raster");
    expect(parsed && parsed.kind === "raster" && parsed.layers).toEqual([]);
  });

  test("round-trip keeps layer pixels and pending filters", () => {
    const raw = {
      kind: "raster" as const,
      width: 640,
      height: 480,
      activeLayerId: "layer-1",
      pendingFilters: ["bw" as const],
      layers: [
        {
          id: "layer-1",
          name: "Слой 1",
          visible: true,
          opacity: 0.8,
          dataUrl: "data:image/png;base64,abc",
        },
      ],
    };
    const once = tryParseDesignPayload(raw);
    const twice = tryParseDesignPayload(JSON.stringify(once));
    expect(twice).toEqual(once);
    expect(twice && twice.kind === "raster" && twice.layers[0]?.dataUrl).toBe(
      "data:image/png;base64,abc",
    );
  });

  test("layout frames survive stringify", () => {
    const seed = emptyLayout();
    seed.frames[0]!.text = "Заголовок сцены";
    const parsed = tryParseDesignPayload(JSON.stringify(seed));
    expect(parsed?.kind).toBe("layout");
    expect(parsed && parsed.kind === "layout" && parsed.frames[0]?.text).toBe(
      "Заголовок сцены",
    );
  });

  test("GET-style parse falls back to empty on junk", () => {
    const fallback = parseDesignPayload("not-json", "raster");
    expect(fallback.kind).toBe("raster");
  });
});

describe("nle timeline", () => {
  test("rejects junk", () => {
    expect(tryParseTimeline("{")).toBeNull();
    expect(tryParseTimeline({ tracks: [] })).toBeNull();
  });

  test("empty tracks-with-no-clips is valid to save, not to compile", () => {
    const empty = emptyTimeline();
    expect(tryParseTimeline(empty)).not.toBeNull();
    expect(timelineHasRenderableClips(empty)).toBe(false);
    expect(isExplicitEmptyCompileClips([])).toBe(true);
    expect(isExplicitEmptyCompileClips(undefined)).toBe(false);
    expect(EMPTY_TIMELINE_COMPILE_ERROR).toMatch(/пустой таймлайн/i);
  });

  test("clip on V1 makes compile eligible", () => {
    const tl = emptyTimeline();
    tl.tracks[0]!.clips.push({
      id: "c1",
      artifactId: "art-1",
      title: "Кадр",
      start: 0,
      inPoint: 0,
      outPoint: 4,
      url: "/gen/scene.png",
      type: "image",
      speed: 1,
      lut: null,
      transition: "cut",
      kenBurns: true,
    });
    const round = tryParseTimeline(JSON.stringify(tl));
    expect(round?.tracks[0]?.clips[0]?.artifactId).toBe("art-1");
    expect(timelineHasRenderableClips(round!)).toBe(true);
  });

  test("parseTimeline falls back to empty tracks", () => {
    const tl = parseTimeline("nope");
    expect(tl.tracks.length).toBeGreaterThan(0);
  });
});

describe("daw state", () => {
  test("rejects missing tracks so junk cannot wipe the project", () => {
    expect(normalizeDawState(null)).toBeNull();
    expect(normalizeDawState("{")).toBeNull();
    expect(normalizeDawState({ bpm: 120 })).toBeNull();
    expect(normalizeDawState({ tracks: "nope" })).toBeNull();
  });

  test("seed pattern is audible; empty tracks are not", () => {
    expect(dawHasAudibleContent(defaultDawState())).toBe(true);
    expect(dawHasAudibleContent({ ...defaultDawState(), tracks: [] })).toBe(false);
    expect(EMPTY_DAW_EXPORT_ERROR).toMatch(/нечего экспортировать/i);
  });

  test("custom lead notes survive normalize", () => {
    const state = normalizeDawState({
      bpm: 96,
      bars: 2,
      masterVolume: 0.5,
      transpose: -2,
      metronome: true,
      tracks: [
        {
          id: "lead-1",
          name: "Лид",
          kind: "lead",
          volume: 0.7,
          pan: 0.2,
          muted: false,
          waveform: "square",
          octave: 4,
          notes: [{ step: 0, midi: 60 }],
        },
      ],
    });
    expect(state?.tracks[0]?.id).toBe("lead-1");
    expect(state?.tracks[0]?.notes?.[0]?.midi).toBe(60);
    expect(dawHasAudibleContent(state!)).toBe(true);
  });
});
