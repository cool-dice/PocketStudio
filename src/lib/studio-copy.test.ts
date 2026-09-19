import { describe, expect, test } from "bun:test";

import {
  AUDIO_LANDING_BLURB,
  AUDIO_MODULE_DESCRIPTION,
  DESIGN_LANDING_BLURB,
  DESIGN_MODULE_DESCRIPTION,
  NLE_SCOPE_HINT,
  VIDEO_LANDING_BLURB,
  VIDEO_MODULE_DESCRIPTION,
} from "./studio-copy";

const FORBIDDEN = /feature-complete|полный Premiere|полный FL|как Premiere|как FL Studio/i;

describe("studio honesty copy", () => {
  test("does not claim Premiere or FL Studio are feature-complete", () => {
    const blob = [
      DESIGN_MODULE_DESCRIPTION,
      AUDIO_MODULE_DESCRIPTION,
      VIDEO_MODULE_DESCRIPTION,
      DESIGN_LANDING_BLURB,
      AUDIO_LANDING_BLURB,
      VIDEO_LANDING_BLURB,
      NLE_SCOPE_HINT,
    ].join("\n");
    expect(blob).not.toMatch(FORBIDDEN);
    expect(DESIGN_MODULE_DESCRIPTION).toMatch(/не Photoshop/i);
    expect(AUDIO_MODULE_DESCRIPTION).toMatch(/не FL Studio/i);
    expect(VIDEO_MODULE_DESCRIPTION).toMatch(/не Premiere/i);
  });
});
