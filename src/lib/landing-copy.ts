import {
  AUDIO_LANDING_BLURB,
  DESIGN_LANDING_BLURB,
  VIDEO_LANDING_BLURB,
} from "./studio-copy";
/**
 * Guest landing + auth CTA copy.
 * Do not promise live hosting, card payouts, or a connected GitHub MCP.
 * First-user-admin sentence is gated by GET /api/auth/bootstrap.
 */

export const LANDING_LOGIN_HREF = "/login";
export const LANDING_REGISTER_HREF = "/login?tab=register";

export function landingCtaHref(intent: "login" | "register"): string {
  return intent === "register" ? LANDING_REGISTER_HREF : LANDING_LOGIN_HREF;
}

export function firstUserAdminHint(firstUserBecomesAdmin = false): string {
  return firstUserBecomesAdmin
    ? "Если в студии ещё нет аккаунтов, первый зарегистрированный пользователь становится администратором."
    : "";
}

export const LANDING_META_DESCRIPTION =
  "PocketStudio — карманная киностудия от А до Я: диалог с ИИ ведёт фильм от замысла и сценария до кадров, озвучки, монтажа и выпуска. Прокат на площадках и карточные выплаты — отдельные шаги.";

export const LANDING_HERO_SUB =
  "От замысла до выпуска: сценарий, раскадровка, кадры, озвучка и монтаж. Книга и музыка остаются рядом, если картине нужны исходник и саундтрек.";

export function landingHeroNote(firstUserBecomesAdmin = false): string {
  return [
    "Без карты.",
    firstUserAdminHint(firstUserBecomesAdmin),
    "Прокат на внешних площадках и живые выплаты — отдельные шаги, не обещание «одной кнопки».",
  ]
    .filter(Boolean)
    .join(" ");
}

export const LANDING_LAUNCH_CAPTION = "черновой выпуск, не прокат";

export const LANDING_DEPLOY_BLURB =
  "Dockerfile и zip готовы. Сборка образа — если docker есть на машине, иначе честный статус «нет демона». Это не публикация на хост.";

export const LANDING_NOTES_BLURB =
  "Замысел, персонажи и обрывки реплик не теряются между сессиями.";

export const LANDING_CRAFT_BLURB =
  "Жанр, тон и привычки студии помнятся от сцены к сцене.";

export const LANDING_MONETIZE_BLURB =
  "Цена и статус картины живут в кабинете. Карточная сеть не подключена.";

export const LANDING_PIPELINE_RELEASE =
  "Смонтируйте картину и заберите файлы. Прокат на площадках — отдельный шаг, не эта кнопка.";

export const LANDING_HOW_DESCRIPTION =
  "Три шага от пустого экрана до чернового выпуска фильма. Прокат на площадках и карточные выплаты — отдельные шаги.";

export const LANDING_HOW_STEP3 =
  "Монтаж собирает черновой выпуск в студии. Прокат и живые выплаты сюда не входят.";

export const LANDING_CHAT_SECTION =
  "Один диалог ведёт картину: сценарий, кадры, озвучка и монтаж, без прыжков между сервисами.";

export const LANDING_CHAT_MOCK_LABEL = "Макет диалога — не живой чат";

export const LANDING_CHAT_MOCK_PILL = "Черновой выпуск · не прокат";

export function landingCtaBandNote(firstUserBecomesAdmin = false): string {
  const admin = firstUserAdminHint(firstUserBecomesAdmin);
  return [
    "Регистрация занимает минуту — киностудия уже ждёт первый замысел.",
    admin,
  ]
    .filter(Boolean)
    .join(" ");
}

export function landingMarketingBlob(): string {
  return [
    LANDING_META_DESCRIPTION,
    LANDING_HERO_SUB,
    landingHeroNote(false),
    landingHeroNote(true),
    LANDING_LAUNCH_CAPTION,
    LANDING_NOTES_BLURB,
    LANDING_CRAFT_BLURB,
    LANDING_MONETIZE_BLURB,
    DESIGN_LANDING_BLURB,
    AUDIO_LANDING_BLURB,
    VIDEO_LANDING_BLURB,
    LANDING_PIPELINE_RELEASE,
    LANDING_HOW_DESCRIPTION,
    LANDING_HOW_STEP3,
    LANDING_CHAT_SECTION,
    LANDING_CHAT_MOCK_LABEL,
    LANDING_CHAT_MOCK_PILL,
    landingCtaBandNote(false),
    landingCtaBandNote(true),
  ].join("\n");
}
