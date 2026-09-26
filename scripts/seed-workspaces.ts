/**
 * Seed content workspaces (Фаза A) — переносит мок-данные визуальной волны
 * в БД: 6 воркспейсов (Project с origin="workspace"), сущности двух наборов,
 * документы с секциями, артефакты Обзора/Альбома и находки Аналитика.
 *
 * Запуск: bun scripts/seed-workspaces.ts [email]
 * Идемпотентно: если воркспейсы ws-* уже есть — выходит без изменений.
 */

import { db } from "../src/lib/db";
import { MOCK_WORKSPACES } from "../src/lib/workspace-data";
import { MOCK_ARTIFACTS } from "../src/components/workspaces/shared/artifacts-data";
import {
  ALBUM_ITEMS,
  ANALYST_FINDINGS,
  ENTITY_SETS,
} from "./seed-workspace-content";

const EMAIL = process.argv[2] ?? "ps2c-audio@vf.io";

/** Тексты секций рукописи «Хроники Долгой Зимы» (сценарная проза). */
const KHRONIKI_SECTIONS: { title: string; content: string }[] = [
  {
    title: "Пролог. Правило тишины",
    content:
      "Род Снежного колеса живёт так давно, что забыл, кто первым сказал: лёд слышит крик. Зимой не повышают голос — ни над очагом, ни над полыньей. Тот, кто закричит, берёт бурю на себя.\n\nАри знает правило наизусть. Знает и другое: правила ломаются не тогда, когда страшно, а когда чужое сердце тонет.",
  },
  {
    title: "Глава 1. Род Снежного колеса",
    content:
      "Тридцать четвёртая зима отнесла мать в буран, и с тех пор Ари считает шаги — от очага до нарта, от нарта до грани родовых угодий. В двенадцать она перестала верить в возвращение, но продолжала слушать лёд: у льда своя музыка, и она честнее людей.\n\nСтеклянный компас рода лежит у старейшины. Стрелка дрожит в трещине — знак, что где-то за перевалом есть тепло.",
  },
  {
    title: "Глава 2. Сёстры",
    content:
      "Вейра, старшая, работает за станком и молчит красивее, чем другие говорят. У неё глаза матери — карие, только теплее.\n\nАри — семнадцать, Вейре двадцать три. Они не ссорятся: в роду не ссорятся, в роду молчат по очереди.",
  },
  {
    title: "Глава 3. Трещина",
    content:
      "Компас разбился на ледяном поле — тонкая, звенящая трещина через стекло. Старейшина сказал: «Весной сдадим в починку Хранителям». Весны в этих краях не наступает.\n\nВейра зашила стежок на рукаве Ари и не спросила, откуда кровь.",
  },
  {
    title: "Глава 6. Исход",
    content:
      "Ари достала компас — стрелка дрожала в трещине, но показывала. Показывала не север. Показывала на маяк за фьордом, которого на картах не было.\n\n«Собирай узелок», — сказал Маркел и развернул карту Исхода. Его керн отсвечивал железом в свете очага.",
  },
  {
    title: "Глава 9. Финал Исхода",
    content:
      "Девятнадцать зим носила она узелок на запястье — считала не годы, а узлы. Лёд поддался не сразу: сначала музыка, потом тишина, потом шаг.\n\nМаяк горел ровно. Вейра смотрела в глаза сестре — карие, как у матери, только теплее. Ари отпустила лёд.",
  },
];

/** Рукопись «Тишина фьорда». */
const FJORD_SECTIONS: { title: string; content: string }[] = [
  {
    title: "Глава 1. Смотритель",
    content:
      "Эйнар принял маяк в наследство от отца вместе с привычкой говорить с фонарём. Лето должно было пройти как всегда: туман, чай, журналы приходящих судов.\n\nПервое судно этого лета не было судном. Это была лодка без паруса, и в ней кто-то пел.",
  },
  {
    title: "Глава 4. Письма без адреса",
    content:
      "Она оставляла письма в жестяной коробке из-под чая — без подписи, без адреса. Эйнар складывал их в ящик стола и не отвечал: на маяке нечего отвечать незнакомцам.\n\nОднажды он заметил, что отвечает вслух.",
  },
  {
    title: "Глава 9. Шторм",
    content:
      "Шторм пришёл с запада, как возвращающийся должник. Фонарь выл, море било в башню ладонями.\n\nВ ту ночь свет маяка был нужен одному человеку — и Эйнар впервые за двадцать лет солгал журналу.",
  },
];

/** SRS-документ «Спека PocketStudio». */
const SPEC_SECTIONS: { title: string; content: string }[] = [
  {
    title: "SRS-3. Пользователи и роли",
    content:
      "Пользователь — центральная сущность платформы. Роли назначаются при регистрации: первый аккаунт получает права администратора (bootstrap-admin).\n\nРоль определяет доступные разделы и лимиты генерации. Смена роли — ручная операция администратора.",
  },
  {
    title: "SRS-4. Диалоги и оркестратор",
    content:
      "Диалог (Thread) — главная единица работы. Оркестратор — LLM-агент с режимами: спросить, план, действовать, ревью.\n\nВсе обращения к ИИ проходят через единый AI-интерфейс платформы.",
  },
  {
    title: "FR-07. Импорт и экспорт",
    content:
      "Пользователь может импортировать проект из шаблона, GitHub-репозитория или zip-архива.\n\nЭкспорт — выгрузка полного воркспейса zip-архивом.",
  },
  {
    title: "FR-12. Редактирование сущностей",
    content:
      "Редактор может создавать и править сущности документов. Издатель дополнительно утверждает публикацию сущности.\n\nАтрибуты сущности редактируются инспектором; связи задаются между сущностями одного набора.",
  },
  {
    title: "SRS-11. Интеграции",
    content:
      "Внешние интеграции подключаются как MCP-серверы (stdio/SSE). Первые: GitHub, Filesystem, Fetch, Playwright.\n\nПоведение при сбое: таймаут, невалидный ответ, просроченный токен — пользователь видит внятное сообщение.",
  },
];

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`✗ Пользователь ${EMAIL} не найден. Укажите email аргументом.`);
    process.exit(1);
  }

  const existing = await db.project.count({
    where: { id: { startsWith: "ws-" }, userId: user.id },
  });
  if (existing > 0) {
    console.log(`Seed уже выполнен (${existing} воркспейсов) — пропускаю.`);
    return;
  }

  // 1. Воркспейсы (id из моков — сохраняем ссылки фронта).
  for (const ws of MOCK_WORKSPACES) {
    await db.project.create({
      data: {
        id: ws.id,
        userId: user.id,
        name: ws.title,
        description: ws.description,
        origin: "workspace",
        type: ws.type,
        stage: ws.stage,
        stageIndex: ws.stageIndex,
        progress: ws.progress,
      },
    });
  }
  console.log(`✓ Воркспейсы: ${MOCK_WORKSPACES.length}`);

  // 2. Сущности: narrative-набор → «Хроники», product-набор → PocketLanding.
  const entityIdMap = new Map<string, string>(); // мок-id → real id
  for (const set of ENTITY_SETS) {
    const projectId =
      set.domain === "narrative" ? "ws-film-dwinter" : "ws-app-landing";
    for (const e of set.entities) {
      await db.entity.create({
        data: {
          id: e.id,
          projectId,
          setId: set.id,
          setName: set.label,
          domain: set.domain,
          kind: e.kind,
          name: e.name,
          short: e.short,
          description: e.description,
          attributes: JSON.stringify(e.attributes),
          tags: JSON.stringify(e.tags),
          refs: JSON.stringify(e.refs),
          portrait: e.portrait ? JSON.stringify(e.portrait) : null,
        },
      });
      entityIdMap.set(e.id, e.id);
    }
    console.log(`✓ Сущности набора «${set.label}» → ${projectId}: ${set.entities.length}`);
  }

  // Связи сущностей (related id-шники внутри набора).
  let linkCount = 0;
  for (const set of ENTITY_SETS) {
    for (const e of set.entities) {
      for (const relId of e.related) {
        const from = entityIdMap.get(e.id);
        const to = entityIdMap.get(relId);
        if (from && to) {
          await db.entityLink.create({ data: { fromId: from, toId: to, kind: "related" } });
          linkCount += 1;
        }
      }
    }
  }
  console.log(`✓ Связи сущностей: ${linkCount}`);

  // 3. Документы с секциями.
  const docK = await db.document.create({
    data: {
      id: "doc-khroniki",
      projectId: "ws-film-dwinter",
      title: "Сценарий: Хроники Долгой Зимы",
      description: "Новелла-первоисточник и сценарная разработка короткометражки.",
      kind: "script",
    },
  });
  await db.documentSection.createMany({
    data: KHRONIKI_SECTIONS.map((s, i) => ({
      documentId: docK.id,
      title: s.title,
      order: i,
      content: s.content,
      status: i >= KHRONIKI_SECTIONS.length - 2 ? "draft" : "done",
    })),
  });

  const docF = await db.document.create({
    data: {
      id: "doc-fjord",
      projectId: "ws-book-fjord",
      title: "Рукопись: Тишина фьорда",
      description: "Психологический роман. Черновик, часть глав готова.",
      kind: "manuscript",
    },
  });
  await db.documentSection.createMany({
    data: FJORD_SECTIONS.map((s, i) => ({
      documentId: docF.id,
      title: s.title,
      order: i,
      content: s.content,
      status: i === FJORD_SECTIONS.length - 1 ? "draft" : "done",
    })),
  });

  const docS = await db.document.create({
    data: {
      id: "doc-spec",
      projectId: "ws-app-landing",
      title: "SRS PocketStudio",
      description: "Спецификация требований к платформе.",
      kind: "spec",
    },
  });
  await db.documentSection.createMany({
    data: SPEC_SECTIONS.map((s, i) => ({
      documentId: docS.id,
      title: s.title,
      order: i,
      content: s.content,
      status: "done",
    })),
  });
  console.log("✓ Документы: 3 с секциями");

  // 4. Артефакты Обзора (пайплайн-карточки).
  for (const a of MOCK_ARTIFACTS) {
    await db.artifact.create({
      data: {
        id: a.id,
        projectId: a.workspaceId,
        type: a.kind,
        title: a.title,
        description: a.meta,
        stage: a.stage,
        meta: JSON.stringify({ gradient: a.gradient, meta: a.meta }),
      },
    });
  }
  console.log(`✓ Артефакты Обзора: ${MOCK_ARTIFACTS.length}`);

  // Альбом (портреты, привязанные к сущностям).
  for (const al of ALBUM_ITEMS) {
    const entityId = entityIdMap.get(al.entityId) ?? null;
    await db.artifact.create({
      data: {
        id: al.id,
        projectId: "ws-film-dwinter",
        type: al.kind === "portrait" ? "image" : al.kind,
        title: al.title,
        description: al.description,
        entityId,
        stage: "Замысел",
        meta: JSON.stringify({
          gradient: al.gradient,
          albumKind: al.kind,
          isCharacter: al.isCharacter,
        }),
      },
    });
  }
  console.log(`✓ Альбом: ${ALBUM_ITEMS.length}`);

  // 5. Находки Аналитика.
  const typeMap: Record<string, string> = {
    contradiction: "contradiction",
    gap: "omission",
    omission: "omission",
    mismatch: "inconsistency",
  };
  const sevMap: Record<string, string> = {
    error: "critical",
    warning: "warning",
    note: "info",
    info: "info",
  };
  for (const f of ANALYST_FINDINGS) {
    await db.finding.create({
      data: {
        id: f.id,
        projectId: f.domain === "narrative" ? "ws-film-dwinter" : "ws-app-landing",
        documentId: f.domain === "narrative" ? docK.id : docS.id,
        scope: f.domain === "narrative" ? "manuscript" : "spec",
        type: typeMap[f.type] ?? "inconsistency",
        severity: sevMap[f.severity] ?? "warning",
        title: f.message,
        quote: f.quote,
        advice: f.hint,
        sourceRef: f.source,
      },
    });
  }
  console.log(`✓ Находки Аналитика: ${ANALYST_FINDINGS.length}`);
  console.log("Seed завершён.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
