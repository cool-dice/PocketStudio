# Task ID: 5-a — Agent: subagent-design

**Task:** Дизайн → живой мудборд + LLM-палитра (Фаза A, дизайн-модуль на данных БД).

## Что сделано

Контекст прочитан из `/home/z/my-project/worklog.md` (секции PS-4, A1+A2) и живого кода:
images-screen как шаблон модуля, describe/route.ts как шаблон AI-роута.

### Созданные файлы

1. **src/lib/palette.ts** (140 строк) — общий домен «Палитра стиля» для сервера и клиента:
   типы `StylePalette` / `PaletteColor` / `PaletteFonts` / `PaletteMeta`, нормализация
   hex (#abc → #AABBCC), `normalizeStylePalette` (валидация ответа LLM/meta: 3–8 цветов),
   `paletteFromArtifact` (stage "style" + meta.kind "palette"), `briefFromArtifact`,
   утилиты `hexLuminance` / `isHexDark` (контраст текста на свотче), `looksSerif`.
2. **src/app/api/ai/palette/route.ts** (135) — POST /api/ai/palette: zod {projectId, brief?},
   `ensureWorkspace` (getUserFromRequest внутри), бриф = name/type/description воркспейса
   (db.project.findFirst по id+userId) + текст пользователя → `aiChatJson` со СТРОГИМ
   JSON-промптом арт-директора (5–6 цветов #RRGGBB, пара шрифтов, mood, advice, всё
   по-русски) → нормализация + regex-фолбэк `\{[\s\S]*\}` → при провале 502 с понятной
   ошибкой. Результат сохраняется как Artifact: type "file", title "Палитра стиля",
   stage "style", meta {kind:"palette", ...палитра, brief}, prompt = бриф. Ответ 201
   {artifact, palette}.
3. **src/lib/api.ts** — добавлен `aiGeneratePalette({projectId, brief?})` →
   {artifact, palette} (импорт типа StylePalette).
4. **src/components/studio/design/design-screen.tsx** (ПЕРЕПИСАН, 379) — оркестратор:
   один `api.listArtifacts(workspaceId)` → производные (плитки image/portrait + палитра);
   локальные Tabs «Мудборд»/«Стиль»; глобальный экран — чипы воркспейсов
   (api.listWorkspaces + counts.images, иконка типа), пустое состояние «выберите
   воркспейс», «К воркспейсам»; loadError с «Повторить»; все мутации: runGenerate
   (stage "design" → сразу в мудборд), toggleBoard (stage design⇄null, оптимистично
   с откатом), removeArtifact (оптимистично с откатом), generatePalette (busy-спиннер);
   prependArtifact с защитой от гонки смены воркспейса (projectId-гард).
5. **src/components/studio/design/moodboard-tab.tsx** (475) — панель генерации кадра
   (промпт + 3 пресета 1024x1024/1152x864/1440x720 + плашка прогресса с таймером
   «~30–45 сек» + pending-плитка сразу с emerald-рамкой), счётчик «В мудборде X из Y»
   (emerald-чип + pluralFrames), сетка 2/3/4 колонки (переиспользован TileArt и домен
   плиток images/gallery-data), emerald-рамка+бейдж «В мудборде» для stage "design",
   оверлей действий (открыть / в мудборд / удалить), клик по плитке → диалог просмотра,
   удаление через shadcn AlertDialog, скелетоны/пустое состояние.
6. **src/components/studio/design/palette-dialog.tsx** (132) — диалог просмотра кадра:
   крупная картинка (или градиентная заглушка TileArt), промпт, dl-метаданные
   (тип/размер/мудборд/создано/файл), действия «В мудборд/Убрать из мудборда»
   (emerald-стейт) + «Открыть оригинал».
7. **src/components/studio/design/style-tab.tsx** (194) — вкладка «Стиль»: карта палитры
   (PaletteCard) или пустое состояние с объяснением и кнопкой «Собрать палитру»
   (фокус в бриф-textarea), форма «Бриф стиля» (textarea + чипы-идеи брифов +
   «Собрать палитру» со спиннером/плашкой прогресса ~10–20 сек), скелетон карты.
8. **src/components/studio/design/palette-card.tsx** (204) — карта палитры: mood-строка,
   сетка свотчей grid-cols-2/sm:3/lg:6 (клик → копия HEX в буфер c fallback
   execCommand + toast, контраст текста по люминансу), превью пары шрифтов системными
   стеками и жирностями (heading serif/sans по эвристике looksSerif, body sans, note),
   совет арт-директора, бриф, честная подпись «Палитра — рекомендация модели, hex
   копируется кликом».
9. **src/components/studio/design/palette-data.ts** (101) — клиентский слой данных:
   BOARD_SIZE_PRESETS (3 пресета), SAMPLE_FRAME_PROMPTS / SAMPLE_BRIEFS, isBoardTile,
   boardTileFromArtifact, pendingBoardTile (stage "design"), pluralFrames,
   re-export formatBoardDate.

### Удалённые файлы (старые мок-файлы, 11 шт.)

design-data.ts, layout-data.ts, layout-tab.tsx, layout-frame.tsx, layout-inspector.tsx,
preview-app.tsx, preview-tab.tsx, raster-history.tsx, raster-panels.tsx, raster-tab.tsx,
files-catalog.tsx. Перед удалением проверено rg по src/: их импортировал только старый
design-screen.tsx (внешних потребителей нет).

## Качество

- tsc --noEmit: НОЛЬ ошибок в моих файлах; src/-ошибки до и после идентичны
  (tool-card 1, use-threads 2, use-voice-recorder 1 — старые долги; documents
  characters/codex 15 — старый долг других агентов, в коммите).
- bun run lint: 0 ошибок, 0 предупреждений.
- dev.log: без ошибок; GET / 200 (компиляция после изменений успешна).
- Тесты не писались (по заданию). Dev-сервер/build не запускались.
- Доступность: aria-label на всех секциях/кнопках/плитках, role=group для пресетов,
  aria-live для прогресса и счётчика, клавиатурный Enter/Space на плитке, focus-visible.
- Адаптив: 390px — сетка 2 колонки (плитки и свотчи), TabsList влезает, без
  горизонтального скролла; vf-scroll/vf-scroll-x для внутренних скроллов.

## Заметки для следующих агентов

- Палитра хранится как Artifact {type: "file", stage: "style", meta.kind: "palette"};
  «в мудборде» = Artifact {type image|portrait, stage: "design"}.
- api.aiGeneratePalette уже в src/lib/api.ts; домен-хелперы в src/lib/palette.ts
  (переиспользуются и роутом, и клиентом).
- Плитки мудборда переиспользуют домен images/gallery-data (tileFromArtifact,
  pendingTile, IMAGE_SIZE_PRESETS) и TileArt — не дублируйте.
