import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { tileFromArtifact } from "@/components/studio/images/gallery-data";
import type { ArtifactDto } from "@/lib/workspace-types";

import {
  IMAGE_EMPTY_FILE,
  IMAGE_GALLERY_EMPTY,
  IMAGE_GALLERY_FILTER_EMPTY,
  IMAGE_GALLERY_LOAD_ERROR,
  IMAGE_GALLERY_LOAD_ERROR_HINT,
  IMAGE_GEN_FAILED,
  IMAGE_GEN_FAILED_HINT,
  IMAGE_GEN_UNCONFIGURED_HINT,
  IMAGE_MISSING_FILE,
  IMAGE_MISSING_FILE_HINT,
  displayableImageSrc,
  isHonestImageUrl,
} from "./image-copy";

function artifact(
  partial: Partial<ArtifactDto> & Pick<ArtifactDto, "id">,
): ArtifactDto {
  return {
    projectId: "ws",
    type: "image",
    title: "маяк",
    description: null,
    url: null,
    prompt: "шторм у маяка",
    entityId: null,
    stage: null,
    meta: null,
    favorite: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("image / gallery honesty copy", () => {
  test("gallery load error is not the empty-gallery message", () => {
    expect(IMAGE_GALLERY_LOAD_ERROR).not.toBe(IMAGE_GALLERY_EMPTY);
    expect(IMAGE_GALLERY_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(IMAGE_GALLERY_LOAD_ERROR_HINT).toMatch(/не пустая/i);
    expect(IMAGE_GALLERY_FILTER_EMPTY).not.toBe(IMAGE_GALLERY_EMPTY);
    expect(IMAGE_GALLERY_FILTER_EMPTY).not.toBe(IMAGE_GALLERY_LOAD_ERROR);
    expect(IMAGE_GALLERY_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(IMAGE_GALLERY_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
  });

  test("failed generation copy is not a ready PNG", () => {
    expect(IMAGE_GEN_FAILED).toMatch(/не удалась/i);
    expect(IMAGE_GEN_FAILED_HINT).toMatch(/не сохранен|не показывается/i);
    expect(IMAGE_GEN_FAILED_HINT).not.toMatch(/готова|placeholder|data:image/i);
    expect(IMAGE_EMPTY_FILE).toMatch(/пустой файл/i);
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(IMAGE_GEN_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(IMAGE_GEN_FAILED).not.toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(IMAGE_MISSING_FILE).toMatch(/отсутствует/i);
    expect(IMAGE_MISSING_FILE_HINT).toMatch(/не открывается/i);
  });

  test("displayableImageSrc never returns a 404 or fake png", () => {
    expect(displayableImageSrc(null)).toBeNull();
    expect(displayableImageSrc({ url: null })).toBeNull();
    expect(displayableImageSrc({ url: "/gen/x.png", fileMissing: true })).toBeNull();
    expect(displayableImageSrc({ url: "data:image/png;base64,abc" })).toBeNull();
    expect(displayableImageSrc({ url: "/placeholder.png" })).toBeNull();
    expect(displayableImageSrc({ url: "/gen/x.png" })).toBe("/gen/x.png");
    expect(isHonestImageUrl("data:image/png;base64,abc")).toBe(false);
    expect(isHonestImageUrl("/gen/ok.png")).toBe(true);
  });

  test("tileFromArtifact does not expose a missing /gen url as img src", () => {
    const tile = tileFromArtifact(
      artifact({
        id: "gone",
        url: "/gen/gone.png",
        fileMissing: true,
      }),
    );
    expect(tile.url).toBeNull();
    expect(tile.fileMissing).toBe(true);
    expect(displayableImageSrc(tile)).toBeNull();
  });
});
