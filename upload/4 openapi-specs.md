# СПЕЦИФИКАЦИЯ API (OPENAPI 3.0) – NARRATIVECORE

## Версия 1.0 – MVP и план до версии 3.0

Все эндпоинты возвращают JSON. Аутентификация: `Authorization: Bearer <token>` (кроме `/auth/*`).  
Базовый URL: `https://api.narrativecore.app/v1`.

---

## 1. АУТЕНТИФИКАЦИЯ И ПОЛЬЗОВАТЕЛИ

### POST `/auth/register`
**Регистрация**

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "string (min 8 chars)"
}
```

**Ответ 201:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "subscriptionTier": "free" },
  "token": "jwt_access_token"
}
```

**Ошибки:** 400 – email уже существует или пароль слишком простой.

### POST `/auth/login`
**Логин**

**Тело запроса:** `{ "email": "...", "password": "..." }`

**Ответ 200:** аналогичен регистрации.

**Ошибки:** 401 – неверные данные.

### POST `/auth/logout`
**Логаут** (инвалидирует токен на бэкенде, если используется чёрный список; для MVP достаточно удалить токен на клиенте)

**Ответ 204.**

### GET `/auth/me`
**Получить текущего пользователя**

**Ответ 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "subscriptionTier": "free|pro|team",
  "subscriptionExpiresAt": "2027-01-01T00:00:00Z",
  "customApiKey": null
}
```

### PUT `/auth/me`
**Обновить профиль** (например, сменить пароль)

**Тело:** `{ "password": "new_password" }`

**Ответ 200:** обновлённый объект пользователя.

---

## 2. ПРОЕКТЫ

### GET `/projects`
**Список проектов пользователя**

**Параметры запроса:** `?limit=20&offset=0`

**Ответ 200:**
```json
{
  "items": [
    { "id": "uuid", "name": "Мой мир", "slug": "my-world", "updatedAt": "...", "isPublic": false }
  ],
  "total": 1
}
```

### POST `/projects`
**Создать проект**

**Тело:**
```json
{
  "name": "Название проекта",
  "settings": {
    "genre": "dystopian",
    "privacy": "private",
    "aiModel": "gpt-4o-mini",
    "illustrationStyle": "cyberpunk"
  }
}
```

**Ответ 201:** полный объект проекта.

### GET `/projects/{projectId}`
**Получить проект**

**Ответ 200:** объект проекта с настройками.

### PUT `/projects/{projectId}`
**Обновить настройки проекта**

**Тело:** частичное обновление `{ "name": "...", "settings": {...} }`

**Ответ 200:** обновлённый проект.

### DELETE `/projects/{projectId}`
**Удалить проект** (пользователь подтверждает, удаляются все данные)

**Ответ 204.**

---

## 3. СУЩНОСТИ

### GET `/projects/{projectId}/entities`
**Список сущностей**

**Параметры:**
- `type` – фильтр по типу (character, faction, location, item, event, rule или пользовательский тип)
- `limit`, `offset`
- `search` – поиск по имени

**Ответ 200:**
```json
{
  "items": [
    { "id": "uuid", "type": "character", "name": "Хохотунья", "fields": {...}, "dynamicFields": {...} }
  ],
  "total": 42
}
```

### POST `/projects/{projectId}/entities`
**Создать сущность**

**Тело:**
```json
{
  "type": "character",
  "name": "Новый персонаж",
  "description": "Описание",
  "fields": { "status": "alive", "factionId": "uuid" },
  "dynamicFields": { "ключ": "значение" }
}
```

**Ответ 201:** созданная сущность.

### GET `/projects/{projectId}/entities/{entityId}`
**Получить сущность**

**Ответ 200:** объект сущности (включая `dynamicFields`).

### PUT `/projects/{projectId}/entities/{entityId}`
**Обновить сущность** (полное или частичное)

**Тело:** то же, что при создании (все поля опциональны)

**Ответ 200:** обновлённая сущность.

### DELETE `/projects/{projectId}/entities/{entityId}`
**Удалить сущность** (удаляются также связи, где она участвует)

**Ответ 204.**

### GET `/projects/{projectId}/entities/types`
**Получить список типов сущностей (предустановленные + пользовательские)**

**Ответ 200:**
```json
{
  "builtin": ["character", "faction", "location", "item", "event", "rule"],
  "custom": [
    { "id": "uuid", "name": "Магический артефакт", "fieldsSchema": [...] }
  ]
}
```

### POST `/projects/{projectId}/entities/types`
**Создать пользовательский тип**

**Тело:**
```json
{
  "name": "Технология",
  "fieldsSchema": [
    { "name": "powerSource", "type": "string" },
    { "name": "cost", "type": "number" }
  ]
}
```

**Ответ 201:** созданный тип.

---

## 4. СВЯЗИ (LINKS)

### GET `/projects/{projectId}/links`
**Получить все связи проекта** (для графа и таблицы)

**Параметры:** `?fromEntityId=...&toEntityId=...&type=...`

**Ответ 200:**
```json
{
  "links": [
    {
      "id": "uuid",
      "fromEntityId": "uuid1",
      "toEntityId": "uuid2",
      "linkType": "ally",
      "label": "союзники с 2075 года"
    }
  ]
}
```

### POST `/projects/{projectId}/links`
**Создать связь**

**Тело:**
```json
{
  "fromEntityId": "uuid1",
  "toEntityId": "uuid2",
  "linkType": "enemy",
  "label": "враждовали из-за ресурсов"
}
```

**Ответ 201.**

### DELETE `/projects/{projectId}/links/{linkId}`
**Удалить связь**

**Ответ 204.**

---

## 5. ГЛАВЫ

### GET `/projects/{projectId}/chapters`
**Список глав (сортировка по order_index)**

**Ответ 200:**
```json
{
  "chapters": [
    { "id": "uuid", "title": "Пролог", "orderIndex": 1, "updatedAt": "...", "summary": "..." }
  ]
}
```

### POST `/projects/{projectId}/chapters`
**Создать главу**

**Тело:**
```json
{
  "title": "Название",
  "content": "Текст в Markdown...",
  "orderIndex": 5 (опционально)
}
```

**Ответ 201:** глава с `meta` (автоматически сгенерированная сводка, пока пустая).

### GET `/projects/{projectId}/chapters/{chapterId}`
**Получить главу**

**Ответ 200:**
```json
{
  "id": "uuid",
  "title": "Глава 1",
  "content": "Markdown...",
  "meta": {
    "summary": "Краткий пересказ",
    "characterIds": ["uuid", ...],
    "locationIds": [...],
    "eventIds": [...],
    "illustrationIds": [...]
  },
  "illustrationUrl": "https://s3.../image.jpg",
  "orderIndex": 1,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### PUT `/projects/{projectId}/chapters/{chapterId}`
**Обновить главу**

**Тело:** `{ "title": "...", "content": "...", "meta": {...} }` (все поля опциональны)

**Ответ 200:** обновлённая глава.

**Примечание:** при изменении `content` система автоматически перегенерирует `meta.summary` (простым парсингом сущностей) – это происходит на бэкенде.

### DELETE `/projects/{projectId}/chapters/{chapterId}`
**Удалить главу**

**Ответ 204.**

### POST `/projects/{projectId}/chapters/reorder`
**Изменить порядок глав**

**Тело:**
```json
{
  "chapterIds": ["uuid1", "uuid2", "uuid3"]  // новый порядок
}
```

**Ответ 200:** успешно.

### POST `/projects/{projectId}/chapters/{chapterId}/parse`
**Распознать сущности в главе** (возвращает список упомянутых сущностей и их статус канона)

**Тело (опционально):** `{ "content": "альтернативный текст" }` (если не передать, используется текущее содержимое главы).

**Ответ 200:**
```json
{
  "mentions": [
    {
      "entityId": "uuid",
      "name": "Хохотунья",
      "canonStatus": "valid",
      "conflicts": []
    },
    {
      "name": "Неизвестный",
      "canonStatus": "missing",
      "conflicts": []
    }
  ]
}
```

---

## 6. ПРОВЕРКА КАНОНА

### POST `/projects/{projectId}/canon/check`
**Запустить полную проверку канона (всех глав)**

**Ответ 200:** задача запущена, возвращается `taskId`.

```json
{ "taskId": "uuid", "status": "pending" }
```

### GET `/projects/{projectId}/canon/task/{taskId}`
**Получить результат проверки**

**Ответ 200 (completed):**
```json
{
  "status": "completed",
  "result": {
    "conflicts": [
      {
        "chapterId": "uuid",
        "chapterTitle": "Глава 1",
        "fragment": "Хохотунья шла по улице",
        "entityId": "uuid",
        "entityName": "Хохотунья",
        "conflictType": "status",
        "details": "В каталоге персонаж мёртв, но в тексте действует"
      }
    ]
  }
}
```

**Примечание:** для MVP конфликты только имённые (статус, фракция). Для полной версии добавятся `conflictType: "semantic"`.

---

## 7. AI-ГЕНЕРАЦИЯ

### POST `/ai/generate/entity`
**Сгенерировать сущность (синхронно, до 10 сек)**

**Тело:**
```json
{
  "projectId": "uuid",
  "type": "character",
  "prompt": "хитрый торговец в трущобах" // опционально
}
```

**Ответ 200:**
```json
{
  "suggestedEntity": {
    "name": "Слепой Крысолов",
    "description": "Старик в промасленной робе...",
    "fields": { "status": "alive", "factionId": null },
    "dynamicFields": { "trade": "контрабанда фильтров" }
  }
}
```

**Ошибки:** 402 – превышена квота; 429 – слишком много запросов.

### POST `/ai/generate/scene`
**Сгенерировать сцену (асинхронно)**

**Тело:**
```json
{
  "projectId": "uuid",
  "chapterId": "uuid",        // опционально (контекст – предыдущие абзацы)
  "prompt": "Допрос Хохотуньи в порту",
  "length": "medium"          // short (<500 слов), medium (500-1500), long (1500-3000)
}
```

**Ответ 202:** `{ "taskId": "uuid", "status": "pending" }`

### GET `/ai/task/{taskId}`
**Получить статус задачи и результат**

**Ответ (completed):**
```json
{
  "status": "completed",
  "result": {
    "type": "scene",
    "content": "Сгенерированный текст в Markdown..."
  }
}
```

### POST `/ai/generate/illustration`
**Запросить генерацию иллюстрации (асинхронно)**

**Тело:**
```json
{
  "projectId": "uuid",
  "chapterId": "uuid",
  "selectedText": "Описание сцены...",
  "style": "cyberpunk" // one of: realistic, anime, cyberpunk, fantasy
}
```

**Ответ 202:** `{ "taskId": "uuid", ... }`

**WebSocket уведомление:** при завершении задачи клиент получает `task_completed` с `taskId`, после чего запрашивает результат через GET `/ai/task/{taskId}` (или тот же эндпоинт возвращает результат напрямую).

---

## 8. ВЕРСИОНИРОВАНИЕ

### GET `/projects/{projectId}/versions`
**Список версий**

**Ответ 200:**
```json
{
  "versions": [
    { "id": "uuid", "comment": "Перед правкой финала", "createdAt": "...", "createdBy": "user_uuid" }
  ]
}
```

### POST `/projects/{projectId}/versions`
**Сохранить ручную версию**

**Тело:** `{ "comment": "Описание изменений" }`

**Ответ 201:** `{ "versionId": "uuid", "snapshotUrl": "s3://..." }`

### POST `/projects/{projectId}/versions/{versionId}/restore`
**Восстановить версию**

**Ответ 200:** успешно.

---

## 9. ЭКСПОРТ

### POST `/projects/{projectId}/export/json`
**Экспорт в JSON**

**Ответ 200:** ссылка на скачивание (временная, S3).

```json
{ "downloadUrl": "https://s3.../export_project_uuid.json", "expiresIn": 3600 }
```

### POST `/projects/{projectId}/export/markdown`
**Экспорт в Markdown-книгу**

**Ответ 200:** аналогично JSON.

### POST `/projects/{projectId}/export/htmlwiki`
**Сгенерировать HTML-вики (может быть асинхронным для больших проектов)**

**Ответ 202:** `{ "taskId": "uuid" }`  
Результат – архив `.zip` по тому же механизму `/ai/task/{taskId}`.

---

## 10. ГРАФ (для фронтенда)

### GET `/projects/{projectId}/graph`
**Получить данные для отображения графа**

**Ответ 200:**
```json
{
  "nodes": [
    { "id": "uuid", "type": "character", "name": "Хохотунья", "fields": {...} }
  ],
  "edges": [
    { "id": "uuid", "from": "uuid1", "to": "uuid2", "type": "ally", "label": "..." }
  ]
}
```

---

## 11. WEBHOOKS / WEBSOCKET

**Подключение:** `wss://api.narrativecore.app/v1/ws?token=<access_token>`

**События, отправляемые клиенту:**
- `task_completed` – `{ "taskId": "uuid", "type": "scene|illustration|export" }`
- `canon_check_completed` – `{ "taskId": "uuid" }`
- (в будущем) `chapter_updated` – для коллаборации.

---

## 12. СТАТУСЫ ОШИБОК (стандартные)

- `400` – Bad Request (некорректные данные)
- `401` – Unauthorized (не передан или невалидный токен)
- `403` – Forbidden (нет прав к проекту)
- `404` – Not Found
- `409` – Conflict (например, дубликат имени сущности в проекте)
- `429` – Too Many Requests (превышена квота AI или ограничение по тарифу)
- `500` – Internal Server Error

---

*Конец документа «Спецификация API»*