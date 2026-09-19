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

export const LANDING_HERO_SUB =
  "PocketStudio превращает диалог с ИИ в творческий конвейер: книги и статьи, изображения, аудио и видео, код приложения — от первой мысли до оффера в студии. Выплаты симулируются: карточная сеть не подключена.";

export function landingHeroNote(firstUserBecomesAdmin = false): string {
  return [
    "Без карты.",
    firstUserAdminHint(firstUserBecomesAdmin),
    "Публикация на внешний хост и живые выплаты — отдельные шаги, не обещание «одной кнопки».",
  ]
    .filter(Boolean)
    .join(" ");
}

export const LANDING_LAUNCH_CAPTION = "zip и Dockerfile, не живой хост";

export const LANDING_DEPLOY_BLURB =
  "Dockerfile и zip готовы. Сборка образа — если docker есть на машине, иначе честный статус «нет демона». Это не публикация на хост.";

export const LANDING_MCP_BLURB =
  "Fetch, файлы и браузер работают в чате. GitHub и другие stdio — сохранённый конфиг, процесс не подключён.";

export const LANDING_MONETIZE_BLURB =
  "Офферы и кабинет выплат. Карточная сеть не подключена: статус ставит админ или симуляция.";

export const LANDING_PIPELINE_MONETIZE =
  "Соберите оффер и кабинет выплат. Карточная сеть не подключена: статус «оплачено» ставит админ или симуляция.";

export const LANDING_HOW_DESCRIPTION =
  "Три шага от пустого экрана до оффера в студии. Внешний хост и карточные выплаты — не часть этой кнопки.";

export const LANDING_HOW_STEP3 =
  "Цена и статус живут в студии. Живой эквайринг ещё не подключён — симуляция и пометка админа, не фейковый «ушло на хост».";

export const LANDING_CHAT_SECTION =
  "Не переключайтесь между редакторами и генераторами: оркестратор слушает, модули исполняют. Хостинг — Dockerfile и локальный preview, не чужой прод.";

export const LANDING_CHAT_MOCK_LABEL = "Макет диалога — не живой чат";

export const LANDING_CHAT_MOCK_PILL = "Оффер · симуляция";

export function landingCtaBandNote(firstUserBecomesAdmin = false): string {
  const admin = firstUserAdminHint(firstUserBecomesAdmin);
  return [
    "Регистрация занимает минуту — студия уже ждёт первую идею.",
    admin,
  ]
    .filter(Boolean)
    .join(" ");
}

export function landingMarketingBlob(): string {
  return [
    LANDING_HERO_SUB,
    landingHeroNote(false),
    landingHeroNote(true),
    LANDING_LAUNCH_CAPTION,
    LANDING_DEPLOY_BLURB,
    LANDING_MCP_BLURB,
    LANDING_MONETIZE_BLURB,
    LANDING_PIPELINE_MONETIZE,
    LANDING_HOW_DESCRIPTION,
    LANDING_HOW_STEP3,
    LANDING_CHAT_SECTION,
    LANDING_CHAT_MOCK_LABEL,
    LANDING_CHAT_MOCK_PILL,
    landingCtaBandNote(false),
    landingCtaBandNote(true),
  ].join("\n");
}
