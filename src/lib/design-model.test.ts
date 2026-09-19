import { describe, expect, test } from "bun:test";

import {
  emptyRaster,
  parseDesignPayload,
  tryParseDesignPayload,
} from "./design-model";
import { parseTimeline, tryParseTimeline } from "./nle-model";

describe("design payload", () => {
  test("rejects garbage instead of silently becoming an empty canvas", () => {
    expect(tryParseDesignPayload("{not json")).toBeNull();
    expect(tryParseDesignPayload({ kind: "raster", layers: [] })).toBeNull();
    expect(tryParseDesignPayload({ hello: 1 })).toBeNull();
  });

  test("keeps a valid raster doc", () => {
    const seed = emptyRaster();
    const parsed = tryParseDesignPayload(seed);
    expect(parsed?.kind).toBe("raster");
    expect(parsed && parsed.kind === "raster" && parsed.layers.length).toBe(1);
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

  test("parseTimeline falls back to empty tracks", () => {
    const tl = parseTimeline("nope");
    expect(tl.tracks.length).toBeGreaterThan(0);
  });
});
