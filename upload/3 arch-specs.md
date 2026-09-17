# АРХИТЕКТУРА И СТЕК ТЕХНОЛОГИЙ – NARRATIVECORE

## 1. ОБЩАЯ АРХИТЕКТУРА

### 1.1. Тип архитектуры
Микросервисная архитектура в минимальном исполнении (для MVP – монолит с чёткими модулями, развёртываемый как единое приложение, но с возможностью выделения AI-воркера).  
**Монорепозиторий** (Turborepo или Nx) для управления пакетами.

### 1.2. Схема взаимодействия

```
[ Браузер пользователя ]
        │
        │ HTTPS / WebSocket
        ▼
[ Nginx / Caddy ] (балансировщик, статика, SSL)
        │
        ▼
[ NestJS Backend Core (модули) ]
        │
        ├── Auth, Projects, Entities, Chapters, Canon, AI Orchestrator, Export
        │
        ▼
[ BullMQ + Redis ]
        │
        ▼
[ AI Worker (отдельный процесс) ] → OpenAI API, Replicate API
        │
        ▼
[ PostgreSQL + pgvector (версия 2.0) ]
[ S3 / MinIO ]
```

### 1.3. Монорепозиторий (структура)

```
narrativecore/
├── apps/
│   ├── backend/            # NestJS приложение
│   └── frontend/           # React + Vite (FSD)
├── packages/
│   ├── shared-types/       # общие TypeScript типы (сущности, DTO, API контракты)
│   ├── api-client/         # сгенерированный клиент для фронта (OpenAPI)
│   ├── eslint-config/      # общие линтеры
│   ├── ts-config/          # общие tsconfig.json
│   └── ui/                 # (опционально) общая библиотека компонентов
├── docker-compose.yml
├── turbo.json
└── package.json
```

---

## 2. БЭКЕНД (NestJS)

### 2.1. Структура модулей

```
apps/backend/src/
├── modules/
│   ├── auth/               # JWT, регистрация, логин
│   ├── users/              # профили, подписки
│   ├── projects/           # CRUD проектов
│   ├── entities/           # CRUD сущностей, динамические поля, связи
│   ├── chapters/           # главы, оглавление, сводки
│   ├── canon/              # проверка канона (алгоритмы подсветки)
│   ├── ai/                 # оркестрация AI-запросов (очередь)
│   ├── export/             # генерация JSON, MD, HTML
│   ├── versions/           # авто-бэкапы, ручные версии
│   ├── websocket/          # уведомления о задачах
│   └── illustrations/      # работа с S3
├── shared/                 # внутренние утилиты (не экспортируются в монорепозиторий)
├── generators/             # OpenAPI генератор (описание эндпоинтов)
└── main.ts
```

### 2.2. База данных – ключевые таблицы (PostgreSQL + pgvector)

(Схема остаётся без изменений, см. предыдущую версию документа. Добавляется только расширение pgvector для версии 2.0.)

### 2.3. Очередь задач (BullMQ)

- `ai_text` – генерация текста.
- `ai_image` – генерация иллюстраций.
- `export` – длительные экспорты (HTML, EPUB в будущем).

### 2.4. AI Worker

- Отдельный процесс, написанный на Node.js (может быть внутри того же монорепозитория, папка `apps/ai-worker`).
- Использует общий пакет `shared-types` для контрактов задач.

---

## 3. ФРОНТЕНД (FSD – Feature-Sliced Design)

### 3.1. Структура по FSD

```
apps/frontend/src/
├── app/                    # инициализация, роутинг, глобальные стили, провайдеры
│   ├── App.tsx
│   ├── routing.tsx
│   └── providers.tsx
├── pages/                  # композиция слоёв для страниц (слои: widgets/features/entities)
│   ├── DashboardPage/
│   │   ├── ui/             # компоненты страницы
│   │   ├── model/          # логика страницы (например, useDashboardData)
│   │   └── index.ts
│   ├── ProjectPage/
│   └── SettingsPage/
├── widgets/                # самостоятельные блоки (оглавление, контекстная панель, граф)
│   ├── ChapterNavigation/
│   ├── ContextPanel/
│   └── GraphCanvas/
├── features/               # сценарии пользователя (генерация AI, экспорт, проверка канона, создание сущности)
│   ├── generateScene/
│   │   ├── ui/
│   │   ├── model/
│   │   └── api/            # вызовы API для этой фичи
│   ├── generateIllustration/
│   ├── exportProject/
│   └── createEntityFromSelection/
├── entities/               # бизнес-сущности (сущность, глава, проект, пользователь)
│   ├── entity/             # карточка сущности, список, CRUD формы
│   │   ├── ui/
│   │   ├── model/
│   │   └── api/
│   ├── chapter/            # редактор, просмотр, сводка
│   └── project/
├── shared/                 # переиспользуемые хелперы, UI-кирпичики, API-клиент
│   ├── api/                # инстанс axios, WebSocket клиент
│   ├── lib/                # утилиты (форматеры, валидаторы)
│   ├── ui/                 # кнопки, модалки, тосты (Shadcn/ui)
│   └── config/             # env, константы
└── index.tsx
```

### 3.2. Интеграция с API

- **Сгенерированный клиент** из OpenAPI (пакет `@narrativecore/api-client`) используется во всех `features/*/api` и `entities/*/api`.
- Типы запросов и ответов берутся из общего пакета `@narrativecore/shared-types`.

### 3.3. Управление состоянием

- **Zustand** – для глобального состояния (текущий проект, пользователь, UI-флаги).
- **React Query** – для кэширования серверных данных (сущности, главы, статус канона).
- **WebSocket** – через `shared/api/websocket` для уведомлений о задачах AI.

---

## 4. ОБЩИЙ ПАКЕТ ТИПОВ И OPENAPI ГЕНЕРАЦИЯ

### 4.1. Пакет `shared-types`

- Содержит:
  - Интерфейсы сущностей (Entity, Project, Chapter и т.д.).
  - DTO для запросов и ответов (например, `CreateEntityDto`, `GenerateSceneRequest`).
  - Enums (SubscriptionTier, EntityType, LinkType).
- Написан на TypeScript, компилируется в `.d.ts` и `.js`.
- Используется бэкендом для валидации (class-validator) и фронтендом для типизации клиента.

### 4.2. Генерация OpenAPI

- **Бэкенд** (NestJS) декорирует контроллеры с помощью `@nestjs/swagger`.
- Автоматически генерируется `openapi.json` (например, при сборке или по команде `npm run swagger`).
- **Фронтенд** (и, опционально, клиент) использует `openapi-typescript` + `openapi-fetch` (или `@hey-api/openapi-ts`) для генерации:
  - TypeScript-типов
  - Тайп-сейфного HTTP-клиента

**Пример команды в монорепозитории:**
```bash
cd apps/backend && npm run swagger:generate  # создаёт openapi.json
cd packages/api-client && npm run generate    # генерирует клиент и типы из openapi.json
```

### 4.3. CI/CD связка

- При изменении бэкенд-контроллеров автоматически перегенерируется `openapi.json`.
- Генерация клиента запускается в CI перед сборкой фронтенда.
- Если API несовместим (ломающие изменения) – пайплайн падает.

---

## 5. ИНФРАСТРУКТУРА (MVP)

### 5.1. Docker Compose для разработки

```yaml
services:
  postgres:   # pgvector
  redis:
  minio:      # S3 эмулятор
  backend:
    build: ./apps/backend
    ports: [3000]
  ai-worker:
    build: ./apps/ai-worker
  frontend:
    build: ./apps/frontend
    ports: [5173]  # Vite dev server
  nginx:
    image: nginx
    ports: [80, 443]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
```

### 5.2. Производственная сборка

- Бэкенд, AI-воркер и фронтенд собираются в отдельные образы.
- Фронтенд – статика, отдаётся через Nginx или CDN.
- Монорепозиторий собирается через Turborepo с кэшированием.

### 5.3. CI/CD (GitHub Actions)

- Шаг 1: `pnpm install`
- Шаг 2: `pnpm run lint`
- Шаг 3: `pnpm run test`
- Шаг 4: `pnpm run build` (Turborepo собирает все пакеты)
- Шаг 5: Генерация OpenAPI и клиента
- Шаг 6: Сборка Docker-образов
- Шаг 7: Деплой на staging/production

---

## 6. МАСШТАБИРОВАНИЕ И ЭВОЛЮЦИЯ

- **Версия 2.0 (RAG + коллаборация)**: добавляется pgvector, RAG-сервис в бэкенде, WebSocket для совместного редактирования (yjs + @hocuspocus).
- **Версия 3.0 (мобильное приложение)**: отдельное приложение React Native в `apps/mobile`, использующее те же `shared-types` и API-клиент.

---

*Конец документа «Архитектура и стек технологий»*