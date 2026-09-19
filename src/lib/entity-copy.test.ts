import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

import {
  CHARACTER_SHEET_NO_LINKS,
  CHARACTER_SHEET_NO_PORTRAIT,
  CHARACTER_SHEET_NO_REFS,
  CHARACTER_SHEET_NO_TRAITS,
  ENTITY_DELETE_FAILED,
  ENTITY_PORTRAIT_FAILED,
  ENTITY_PORTRAIT_FAILED_HINT,
  ENTITY_PORTRAIT_UNCONFIGURED_HINT,
  ENTITY_SHEET_NO_ATTRIBUTES,
  ENTITY_SHEET_NO_LINKS,
  ENTITY_SHEET_NO_REFS_NARRATIVE,
  ENTITY_SHEET_NO_REFS_PRODUCT,
  ENTITY_SHEET_NO_TAGS,
  ENTITY_SHEET_OPEN_ERROR,
  ENTITY_SHEET_OPEN_ERROR_HINT,
  ENTITY_TAB_EMPTY,
  ENTITY_TAB_FILTER_EMPTY,
  ENTITY_TAB_LOAD_ERROR,
  ENTITY_TAB_LOAD_ERROR_HINT,
  WORLD_EMPTY_RE,
} from "./entity-copy";

describe("entity sheet empty/error copy", () => {
  test("card empties are about this record, not an empty world", () => {
    const sheet = [
      ENTITY_SHEET_NO_ATTRIBUTES,
      ENTITY_SHEET_NO_LINKS,
      ENTITY_SHEET_NO_TAGS,
      ENTITY_SHEET_NO_REFS_NARRATIVE,
      ENTITY_SHEET_NO_REFS_PRODUCT,
      CHARACTER_SHEET_NO_TRAITS,
      CHARACTER_SHEET_NO_LINKS,
      CHARACTER_SHEET_NO_REFS,
      CHARACTER_SHEET_NO_PORTRAIT,
      ENTITY_SHEET_OPEN_ERROR,
      ENTITY_SHEET_OPEN_ERROR_HINT,
    ].join("\n");
    expect(sheet).toMatch(/[А-Яа-яЁё]/);
    expect(sheet).toMatch(/этой карточк|этого персонажа|эту карточку/i);
    expect(sheet).not.toMatch(WORLD_EMPTY_RE);
    expect(ENTITY_SHEET_OPEN_ERROR).not.toMatch(/сущностей пока нет/i);
  });

  test("tab load error is not the empty-catalog message", () => {
    expect(ENTITY_TAB_LOAD_ERROR).not.toBe(ENTITY_TAB_EMPTY);
    expect(ENTITY_TAB_LOAD_ERROR).not.toMatch(WORLD_EMPTY_RE);
    expect(ENTITY_TAB_LOAD_ERROR_HINT).toMatch(/не пустой набор/i);
    expect(ENTITY_TAB_FILTER_EMPTY).not.toMatch(WORLD_EMPTY_RE);
  });

  test("failed portrait copy keeps the previous image and uses UNCONFIGURED Russian", () => {
    expect(ENTITY_PORTRAIT_FAILED).toMatch(/предыдущ/i);
    expect(ENTITY_PORTRAIT_FAILED).not.toMatch(/placeholder|fake image|data:image/i);
    expect(ENTITY_PORTRAIT_FAILED_HINT).toMatch(/сохранён/i);
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(ENTITY_PORTRAIT_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(ENTITY_DELETE_FAILED).toMatch(/удалить/i);
  });
});
