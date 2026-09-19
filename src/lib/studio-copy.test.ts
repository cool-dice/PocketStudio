import { describe, expect, test } from "bun:test";

import {
  AUDIO_LANDING_BLURB,
  AUDIO_MODULE_DESCRIPTION,
  DESIGN_LANDING_BLURB,
  DESIGN_MODULE_DESCRIPTION,
  NLE_SCOPE_HINT,
  PREVIEW_HTML_HINT,
  PREVIEW_LISTING_HINT,
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

  test("iframe preview does not claim a Next server is running", () => {
    expect(PREVIEW_HTML_HINT).toMatch(/статический html/i);
    expect(PREVIEW_HTML_HINT).toMatch(/не запущенный/i);
    expect(PREVIEW_LISTING_HINT).toMatch(/не запущенное приложение/i);
    expect(`${PREVIEW_HTML_HINT}\n${PREVIEW_LISTING_HINT}`).not.toMatch(
      /приложение запущено|dev-сервер работает|next server is running/i,
    );
  });
});
