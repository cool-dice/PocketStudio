import { describe, expect, test } from "bun:test";

import {
  ALBUM_EMPTY,
  ALBUM_EMPTY_HINT,
  ALBUM_FILTER_EMPTY,
  ALBUM_LOAD_ERROR,
  ALBUM_LOAD_ERROR_HINT,
  ALBUM_MISSING_FILE,
  ALBUM_MISSING_FILE_HINT,
  ALBUM_NO_WORKSPACE,
  ALBUM_REMOVE_FAILED,
} from "./album-copy";

describe("album honesty copy", () => {
  test("load error is not the empty-album message", () => {
    expect(ALBUM_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(ALBUM_LOAD_ERROR).not.toBe(ALBUM_EMPTY);
    expect(ALBUM_LOAD_ERROR).not.toMatch(/пока нет работ/i);
    expect(ALBUM_LOAD_ERROR_HINT).toMatch(/не пустой альбом/i);
    expect(ALBUM_EMPTY_HINT).toMatch(/библиотек|сгенерир/i);
  });

  test("filter miss is distinct from empty album and from error", () => {
    expect(ALBUM_FILTER_EMPTY).not.toBe(ALBUM_EMPTY);
    expect(ALBUM_FILTER_EMPTY).not.toBe(ALBUM_LOAD_ERROR);
    expect(ALBUM_NO_WORKSPACE).not.toBe(ALBUM_EMPTY);
    expect(ALBUM_NO_WORKSPACE).not.toMatch(/пока нет работ/i);
  });

  test("missing file copy is not a download success", () => {
    expect(ALBUM_MISSING_FILE).toMatch(/отсутствует/i);
    expect(ALBUM_MISSING_FILE_HINT).toMatch(/не открывается/i);
    expect(ALBUM_MISSING_FILE_HINT).not.toMatch(/скачать|открыть файл/i);
    expect(ALBUM_REMOVE_FAILED).toMatch(/убрать/i);
    expect(ALBUM_REMOVE_FAILED).not.toMatch(/убрано из альбома$/i);
  });
});
