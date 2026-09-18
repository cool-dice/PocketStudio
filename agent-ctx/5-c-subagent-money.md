# Task 5-c — subagent-money: Монетизация → LLM-план в БД; Деплой → честный экспорт ZIP

Статус: ДОСТАВЛЕНО (код + API + браузерная верификация). Полный лог — в worklog.md, секция «Task ID: 5-c».

## Что сделано

### API (новые)
- `POST /api/ai/monetize` — LLM-план монетизации (z-ai-web-dev-sdk, aiChatJson): бриф = данные воркспейса (тип/название/описание/стадия/инвентарь артефактов) + бриф юзера; строго JSON {concept, products 3-5, channels 3-4, steps 4-6, forecast 3 точки ₽}; мягкая нормализация; пустой план → 502. Сохранение: прежний план-документ (kind=spec, title «План монетизации…») удаляется, создаётся новый с 5 секциями (Концепция / Продукты и цены / Каналы / План запуска / Прогноз, status=done). JSON-маркеры (ПРОДУКТЫ_JSON: и т.п.) первой строкой content + человекочитаемый текст. Бриф — в description. Ответ {document, plan} 201. Живой тест: 201 за 6.4 сек, регенерация заменяет документ.
- `GET /api/workspaces/[id]/export` — честный ZIP-экспорт (jszip): artifacts/ (медиа /gen/* с FS + manifest.json), documents/*.md (RU-транслит slug), entities.json, findings.json, README.md (тип/стадия/прогресс/состав). application/zip + Content-Disposition. Тест: 315 КБ с реальными PNG+WAV; 401 без авторизации.
- `src/lib/api.ts`: + `aiMonetize(projectId, brief?)`, + `exportWorkspaceZip(projectId)` (fetch→Blob с Bearer; deleteDocument уже существовал).

### UI (переписаны с моков)
- `monetize/monetize-screen.tsx` (259) — глобальный экран с чипами воркспейсов + вкладка воркспейса: PlanCard (пустое состояние с брифом / generating-скелетон / готовый план), ForecastChart, AssetsSection.
- Компаньоны: `plan-data.ts` (150, парсеры маркеров), `plan-card.tsx` (351, продукты с ценами-бейджами emerald, «Пересобрать» через AlertDialog с префиллом брифа), `forecast-chart.tsx` (87, CSS bar-chart + «прогноз модели — не гарантия»), `assets-section.tsx` (194, реальные артефакты: счётчики + список с «открыть» target=_blank, favorite).
- `deploy/deploy-screen.tsx` (343) — «Экспорт и публикация»: честная карточка «Деплой в облако — за пределами песочницы» (CloudOff), ReadinessCard, кнопка «Скачать ZIP воркспейса» → blob-download («Собираем архив…»), состав архива чеклистом; глобальный экран с чипами.
- `deploy/readiness-card.tsx` (158) — реальный чеклист из БД (изображения/аудио/документы/сущности/открытые находки) + Progress(ws.progress).

### Удалено (14 моков)
monetize: data.ts, payouts-section.tsx, pricing-tiers.tsx, publications-section.tsx, revenue-chart.tsx, stat-tiles.tsx.
deploy: build-log-card.tsx, deploy-bits.tsx, deploy-data.ts, deploy-history-table.tsx, env-vars-card.tsx, hosts-section.tsx, pipeline-card.tsx, use-deploy-pipeline.ts.
(section-heading.tsx оставлен — переиспользуется.)

## Верификация
- tsc: 0 ошибок в моих файлах (в src/ 4 старых долга + 15 ошибок documents/* от параллельных агентов — не мои).
- lint: 0 errors / 0 warnings. dev.log чист.
- Браузер (:81, 1280×800 + 390×844): план сгенерирован из UI за ~11 сек с брифом; реген-диалог с префиллом; ZIP скачан из UI (~/Downloads/podkast-teplyy-lampovyy-export.zip); overflowX=false на мобиле.
- Скриншоты: tool-results/5c-*.png.

## Заметки для следующих агентов
- План-документ ищется так: kind === "spec" && title.startsWith("План монетизации") (см. plan-data.ts isPlanDocument).
- JSON-маркеры секций — часть контракта: первая строка секции `ИМЯ_JSON:{...}`, ниже человекочитаемый текст; парсинг — planFromDocument().
- Экспорт отдаёт Blob через api.exportWorkspaceZip (Bearer-авторизация, window.location не годится в iframe-песочнице).
- Выплаты/биллинг в UI монетизации сознательно отсутствуют (за пределами песочницы).
