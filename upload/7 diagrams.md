# ДИАГРАММЫ ПРОЕКТА – NARRATIVECORE (ТОЛЬКО MERMAID)

Все диаграммы переписаны в формате Mermaid, который гарантированно отображается в вашем окружении. Полный набор: компоненты, развёртывание, последовательность, классы, состояния, C4, ER, активность, инфраструктура.

---

## 1. ДИАГРАММА КОМПОНЕНТОВ

```mermaid
graph TB
    User[Писатель / Сценарист]

    subgraph NarrativeCore
        Web[React + FSD<br/>Веб-приложение]
        API[NestJS API Gateway]
        Auth[Auth Module]
        Proj[Project Module]
        Canon[Canon Engine]
        AI[AI Orchestrator]
        Worker[AI Worker]
        ExportW[Export Worker]
        DB[(PostgreSQL + pgvector)]
        Redis[(Redis / BullMQ)]
        S3[(S3 Storage)]
    end

    User -->|HTTPS| Web
    Web -->|REST / WebSocket| API
    API --> Auth
    API --> Proj
    API --> Canon
    API --> AI
    Proj --> DB
    Canon --> DB
    AI --> Redis
    Worker --> Redis
    Worker --> DB
    Worker --> S3
    ExportW --> DB
    ExportW --> S3
```

---

## 2. ДИАГРАММА РАЗВЁРТЫВАНИЯ (DEPLOYMENT)

```mermaid
graph TD
    Browser[Браузер пользователя]
    Nginx[Nginx Reverse Proxy]
    Frontend[Frontend Container]
    Backend[Backend Container]
    AIWorker[AI Worker Container]
    RedisC[Redis Container]
    PostgresC[PostgreSQL Container]
    MinIO[MinIO S3 Container]

    Browser --> Nginx
    Nginx --> Frontend
    Nginx --> Backend
    Backend --> RedisC
    Backend --> PostgresC
    Backend --> AIWorker
    AIWorker --> PostgresC
    AIWorker --> MinIO
```

---

## 3. ДИАГРАММА ПОСЛЕДОВАТЕЛЬНОСТИ (ГЕНЕРАЦИЯ СЦЕНЫ, MVP)

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend (React)
    participant API as API Gateway (NestJS)
    participant AIO as AI Orchestrator
    participant Queue as BullMQ (Redis)
    participant Worker as AI Worker
    participant OpenAI as OpenAI API
    participant DB as PostgreSQL

    User->>FE: Нажимает "Сгенерировать сцену"
    FE->>API: POST /ai/generate/scene
    API->>AIO: createTask()
    AIO->>Queue: add(ai_text, {projectId, prompt})
    AIO-->>API: {taskId, status: pending}
    API-->>FE: 202 Accepted, taskId
    FE-->>User: Отображает "Генерация начата..."

    loop Каждые 2 сек
        FE->>API: GET /ai/task/{taskId}
        API-->>FE: status: pending
    end

    Queue->>Worker: pull task
    Worker->>DB: Загрузить контекст (сущности, последнюю главу)
    Worker->>OpenAI: API call (prompt + контекст)
    OpenAI-->>Worker: сгенерированный текст
    Worker->>DB: Сохранить результат (опционально)
    Worker->>Queue: task completed

    FE->>API: GET /ai/task/{taskId}
    API-->>FE: {status: completed, result: {content}}
    FE->>FE: Вставить текст в редактор
    FE-->>User: Показать результат
```

---

## 4. ДИАГРАММА СОСТОЯНИЙ (AI-ЗАДАЧА)

```mermaid
stateDiagram-v2
    [*] --> PENDING : задача создана
    PENDING --> PROCESSING : воркер взял в работу
    PROCESSING --> COMPLETED : успешное выполнение
    PROCESSING --> FAILED : ошибка (таймаут, API, квота)
    FAILED --> PENDING : повторная попытка (макс. 3 раза)
    COMPLETED --> [*]
    FAILED --> [*] : после максимальных попыток
    note right of PROCESSING : Статус проверяется клиентом каждые 2с или через WebSocket
```

---

## 5. ДИАГРАММА КЛАССОВ (УПРОЩЁННО – ОСНОВНЫЕ СУЩНОСТИ)

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String passwordHash
        +Enum subscriptionTier
        +String customApiKey
        +createProject()
        +getProjects()
    }
    class Project {
        +UUID id
        +UUID ownerId
        +String name
        +JSON settings
        +Boolean isPublic
        +addEntity()
        +addChapter()
        +createSnapshot()
    }
    class Entity {
        +UUID id
        +UUID projectId
        +String type
        +String name
        +String description
        +JSON fields
        +JSON dynamicFields
        +update()
        +delete()
    }
    class Link {
        +UUID id
        +UUID fromEntityId
        +UUID toEntityId
        +String linkType
        +String label
    }
    class Chapter {
        +UUID id
        +UUID projectId
        +String title
        +String content
        +JSON meta
        +String illustrationUrl
        +Int orderIndex
        +parseEntities()
        +generateSummary()
    }
    class Version {
        +UUID id
        +UUID projectId
        +String snapshotUrl
        +String comment
        +Date createdAt
    }
    class Task {
        +UUID id
        +UUID projectId
        +Enum type
        +Enum status
        +JSON result
        +Date createdAt
    }
    User "1" --> "0..*" Project
    Project "1" --> "0..*" Entity
    Project "1" --> "0..*" Chapter
    Project "1" --> "0..*" Version
    Project "1" --> "0..*" Task
    Entity "1" --> "0..*" Link : from
    Entity "1" --> "0..*" Link : to
```

---

## 6. ER-ДИАГРАММА БАЗЫ ДАННЫХ (ПОЛНАЯ)

```mermaid
flowchart LR
    users(users)
    projects(projects)
    entity_types(entity_types)
    entities(entities)
    links(links)
    chapters(chapters)
    versions(versions)
    tasks(tasks)
    vector_store(vector_store)

    users -->|owns| projects
    projects -->|contains| entity_types
    projects -->|contains| entities
    projects -->|contains| chapters
    projects -->|has| versions
    projects -->|generates| tasks
    projects -->|has_embeddings| vector_store
    entities -->|from| links
    entities -->|to| links
    users -->|saves| versions
```

---

## 7. C4 КОНТЕЙНЕРНАЯ ДИАГРАММА (УРОВЕНЬ 2)

```mermaid
graph TB
    Person[Писатель]

    subgraph NarrativeCore
        Web[Веб-приложение<br/>React + FSD]
        API[API<br/>NestJS]
        AIW[AI Worker<br/>Node.js]
        EXW[Export Worker<br/>Node.js]
        DB[(База данных<br/>PostgreSQL)]
        Cache[(Кэш/Очереди<br/>Redis)]
        Storage[(Файловое хранилище<br/>S3)]
    end

    Person -->|HTTPS| Web
    Web -->|REST/WS| API
    API -->|SQL| DB
    API -->|кэш| Cache
    AIW -->|pull задач| Cache
    AIW -->|чтение| DB
    AIW -->|запись| Storage
    EXW -->|чтение| DB
    EXW -->|запись| Storage
```

---

## 8. ДИАГРАММА АКТИВНОСТИ (СОЗДАНИЕ СУЩНОСТИ ИЗ ТЕКСТА)

```mermaid
flowchart TD
    Start([Пользователь выделяет текст]) --> A[Нажимает "Создать сущность"]
    A --> B{Выделенный текст содержит имя?}
    B -->|Да| C[Подставить имя в поле name]
    B -->|Нет| D[Запросить ввод имени в модальном окне]
    C --> E[Выбор типа сущности]
    D --> E
    E --> F[Заполнение обязательных полей]
    F --> G[Нажатие "Сохранить"]
    G --> H[Фронтенд → POST /entities]
    H --> I[Бэкенд валидирует данные]
    I --> J[Сохраняет в БД]
    J --> K[Закрыть модальное окно]
    K --> L[Обновить контекстную панель]
    L --> M[Обновить граф (если открыт)]
    M --> Stop([Готово])
```

---

## 9. ДИАГРАММА ВЗАИМОДЕЙСТВИЯ С ИНФРАСТРУКТУРОЙ (OPS)

```mermaid
graph LR
    User[Пользователь]
    CDN[CDN CloudFront]
    LB[Load Balancer Nginx]
    FE[Frontend Pods]
    BE[Backend Pods]
    AIW[AI Worker Pods]
    EXW[Export Worker Pods]
    RDS[(PostgreSQL RDS)]
    EC[(Redis ElastiCache)]
    S3[(S3 Bucket)]

    User --> CDN
    CDN --> LB
    LB --> FE
    LB --> BE
    BE --> RDS
    BE --> EC
    AIW --> EC
    AIW --> RDS
    AIW --> S3
    EXW --> RDS
    EXW --> S3
    BE --> S3
```

---

Все диаграммы теперь в формате Mermaid. Скопируйте их в любой поддерживающий Mermaid инструмент (GitHub Markdown, Obsidian, Mermaid Live, Notion и др.) – они отобразятся корректно.

*Конец документа «Диаграммы проекта (Mermaid)»*