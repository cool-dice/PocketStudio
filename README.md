# PocketStudio

Карманная творческая студия: чат-оркестратор + воркспейсы (книга, фильм, музыка, приложение).

Полное приложение по [`docs/ROADMAP.md`](docs/ROADMAP.md) и [`docs/MVP.md`](docs/MVP.md) — без сознательных срезов модулей. Внешние сервисы (Stripe, docker daemon) **эмулируются честно**: экраны и данные живые, адаптер пишет `simulated` / `unavailable`, а не фейковый успех.

Стек: Next.js 16, bun, Prisma + **PostgreSQL / pgvector**, socket.io-агент на `:3003`.
Ключи ИИ **не** кладутся в `.env` — их задаёт админ в панели (OpenAI-совместимый или Anthropic-совместимый шлюз). z-ai не используется.

Сессия: cookie `ps_session` (httpOnly) и `ps_token` в localStorage. Старые `vf_session` / `vf_token` ещё читаются, чтобы не выкинуть уже вошедших. Смена пароля и «Выйти на всех устройствах» поднимают `User.tokenVersion` — прежние JWT сразу 401. Обычный «Выйти» чистит только cookie этого браузера.

**SQLite не является рабочим хранилищем.** Продукт поднимается на пустом Postgres.

## Что входит

Чат-оркестратор, воркспейсы с URL `/w/[id]`, блокнот и quest/onboarding, документы+ИИ, изображения, растр/макет, DAW, NLE-lite, код (Monaco, git, zip, iframe-превью), деплой (Dockerfile + docker build если демон есть), MCP, скиллы (SKILL.md в промпте агента + магазин с внутренним purchased), монетизация (офферы, кабинет выплат, simulated-оплата), админ (пользователи, инвайты, аудит, ИИ, оплаты), **RAG** (эмбеддинги + keyword fallback в том же скоупе).

## Требования

- [bun](https://bun.sh) 1.1+
- git (для чекпоинтов код-проектов)
- Docker (для Postgres) или свой PostgreSQL 16 с расширением [pgvector](https://github.com/pgvector/pgvector)

## Запуск с нуля

```bash
cp .env.example .env
# задайте AUTH_SECRET (любая длинная строка). Без него сессии и шифрование ключей
# используют dev-фолбэк — только для локалки.

docker compose up -d postgres
bun install
bunx prisma generate
bun run db:push          # prisma db push + CREATE EXTENSION vector + HNSW
bun run dev
```

`DATABASE_URL` по умолчанию: `postgresql://pocketstudio:pocketstudio@127.0.0.1:5432/pocketstudio`.
Агент (`bun run dev:agent`) читает тот же `DATABASE_URL`.

Откройте http://localhost:3000

Агент чата (`:3003`) поднимается сам: UI дергает `POST /api/health/agent-service`.
Вручную:

```bash
bun run dev:agent
```

Логи агента: `/tmp/agent-service.log`.

Если рядом лежит старый `db/custom.db` и его нужно перенести (секреты не коммитить):

```bash
DATABASE_URL=postgresql://… bun scripts/migrate-sqlite-to-postgres.ts
# затем POST /api/rag/reindex или кнопка «Переиндексировать»
```

На этом этапе свежий `db push` на пустой Postgres — нормальный путь.

## Legacy packagers (не продукт)

`.zscripts/` и `tests/database-runtime-build.sh` — leftover **z-ai / SQLite** упаковщики
песочницы (`file:./db/custom.db`). Это не способ запустить PocketStudio: в `package.json`
их нет. См. `.zscripts/README.md`.

## Postgres не поднимается

- `docker compose up -d postgres` требует **Docker daemon**. Если демона нет, поставьте PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector) сами и пропишите `DATABASE_URL` в `.env`.
- Порт 5432 занят: остановите чужой Postgres или смените `ports` в `docker-compose.yml` и URL.
- `bun run test` / `db:push` падают с `Can't reach database server`: демон не слушает `127.0.0.1:5432`. Проверьте `docker compose ps` и `pg_isready -h 127.0.0.1 -p 5432`.
- После wipe тома: `docker compose down -v` удалит данные. Затем снова `bun run db:push`.
- SQLite (`file:./db/custom.db`) **не** является рабочим хранилищем — тесты подменяют такой URL на дефолтный Postgres.

## Платежи (честно)

Кабинет офферов живой. Режимы:

| Режим | Что происходит |
|---|---|
| `simulated` (по умолчанию) | «Симулировать оплату» помечает оффер `paid` и создаёт выплату `pending`. Карты нет. |
| `live` + нет `PAYMENTS_API_KEY` | Сервер отказывает, клиент не рисует «оплачено». |
| `live` + ключ задан | Ключ принят, **эквайринг всё равно не подключён** — отказ, не фейковый charge. |

Админ может пометить оффер оплаченным вручную. Это не прохождение карты.

## Первый пользователь = админ

1. На лендинге «Создать аккаунт».
2. Если база пустая, этот пользователь получает роль `admin`.
3. Либо задайте `ADMIN_EMAIL` / `ADMIN_PASSWORD` в `.env` — сид создаст админа при первой регистрации.

Дальше: Профиль → **Админ-панель** → **Модели ИИ** — провайдер, ключ, модели, дефолты инструментов (`agent`, `notes`, `image`, `tts`, `embeddings`, …).

Для RAG назначьте OpenAI-совместимую модель с `capEmbeddings` инструменту **Эмбеддинги** (например `text-embedding-3-small`, 1536 измерений). Anthropic эмбеддинги не умеет.

Если ИИ не настроен, чат и генерации отвечают по-русски («настройте провайдера»), а не падают.
Явная переиндексация без модели эмбеддингов — русская ошибка. Поиск без векторов идёт keyword-fallback с пометкой «поиск без эмбеддингов», в том же скоупе.

## RAG: скоупы

| Чат | Скоуп |
|---|---|
| Главный (Thread.projectId = null), бейдж **вся студия** | `userId = я`, любые `projectId` включая null (инбокс) |
| Воркспейс `/w/{id}`, бейдж **этот воркспейс** | `userId = я AND projectId = этот id` |

Никогда не пересекаем `userId`. Чат воркспейса **не** видит файлы, заметки и код соседней студии.

**Свой кодер в воркспейсе «Приложение» не видит другие репозитории.** Он ограничен `Project.id` / `rootPath` этой студии. Главный чат может *знать*, что есть книга «Тишина» и приложение «coder», и цитировать имена — но не вываливать чужой репозиторий в тред кодера.

Индексация: на запись заметок, глав, сущностей, артефактов, скиллов и сохранений/патчей файлов. Удаление заметки, главы, файла или документа снимает чанки. Кнопки «Переиндексировать» — в Настройки ИИ (все данные пользователя) и в настройках воркспейса — идемпотентны (сначала чистят сиротские чанки). Админ может `POST /api/rag/reindex` с `{ "all": true }`.

Эмбеддинги должны быть **1536 измерений** (например `text-embedding-3-small`). Другая размерность — ясная русская ошибка, не молчаливый NULL.

## Золотой путь

1. Зарегистрироваться на `/login` (первый пользователь = admin, если студия ещё пустая).
2. Пройти или пропустить onboarding.
3. Настроить ИИ в админке, включая эмбеддинги.
4. Инструменты → Скиллы: включить нужные SKILL.md.
5. Воркспейсы → создать → URL станет `/w/{id}`.
6. Вкладка **Чат**: попросить записать заметку / главу / картинку. Индикатор контекста — «этот воркспейс».
7. Документы / Изображения / Дизайн (растр) / Видео (монтаж) / Аудио (DAW).
8. Доход: создать оффер, симулировать оплату.
9. Экспорт: zip, WAV, WebM, Dockerfile / docker build.

Подробный скрипт — в [`docs/MVP.md`](docs/MVP.md) § 8.

## Промпты

Все system-промпты собраны в [`src/lib/ai/prompts.ts`](src/lib/ai/prompts.ts)
(заметки, аналитик, глава, палитра, монетизация, описание сущностей, скоупы RAG) и
[`mini-services/agent-service/prompts.ts`](mini-services/agent-service/prompts.ts)
(штурман, режимы ask/plan/act/review, планировщик, ревьюер).
Инвентарь и решения — [`docs/PROMPTS.md`](docs/PROMPTS.md).
Порт прототипов — [`docs/PROTOTYPE-PORT.md`](docs/PROTOTYPE-PORT.md).

## Тесты

```bash
bun run test
```

Шлюз `src/lib/ai` + RAG (`src/lib/rag`, изоляция скоупов) + дымовой `src/app/api/mvp.smoke.test.ts` (нужен живой Postgres) + тесты промптов агента и `parseToolCall`.

E2E эмбеддингов требует ключ OpenAI-совместимой модели, назначенной на tool `embeddings`.

## Не коммитить

- `db/custom.db*`
- `.env` с секретами
- ключи провайдеров
