import { describe, expect, test } from "bun:test";

import {
  LANDING_CHAT_MOCK_LABEL,
  LANDING_CHAT_MOCK_PILL,
  LANDING_DEPLOY_BLURB,
  LANDING_LOGIN_HREF,
  LANDING_MCP_BLURB,
  LANDING_MONETIZE_BLURB,
  LANDING_REGISTER_HREF,
  firstUserAdminHint,
  landingCtaBandNote,
  landingCtaHref,
  landingHeroNote,
  landingMarketingBlob,
} from "./landing-copy";

const FORBIDDEN =
  /живой хостинг|опубликовано на хосте|выплачено картой|выплата на карту|GitHub MCP подключ|MCP GitHub подключ|подключён GitHub MCP|github mcp connected/i;

describe("landing CTA and honesty copy", () => {
  test("CTAs go to /login or register tab", () => {
    expect(LANDING_LOGIN_HREF).toBe("/login");
    expect(LANDING_REGISTER_HREF).toBe("/login?tab=register");
    expect(landingCtaHref("login")).toBe("/login");
    expect(landingCtaHref("register")).toBe("/login?tab=register");
  });

  test("first-user-admin copy only when the bootstrap flag is true", () => {
    expect(firstUserAdminHint()).toBe("");
    expect(firstUserAdminHint(true)).toMatch(/администратор/i);
    expect(firstUserAdminHint(true)).toMatch(/ещё нет аккаунтов/i);
    expect(firstUserAdminHint(false)).toBe("");
    expect(landingHeroNote(true)).toMatch(/администратор/i);
    expect(landingHeroNote(false)).not.toMatch(/администратор/i);
    expect(landingHeroNote()).not.toMatch(/администратор/i);
    expect(landingCtaBandNote(false)).not.toMatch(/администратор/i);
    expect(landingCtaBandNote()).not.toMatch(/администратор/i);
  });

  test("does not promise live hosting, card payouts, or GitHub MCP connected", () => {
    const blob = landingMarketingBlob();
    expect(blob).not.toMatch(FORBIDDEN);
    expect(LANDING_DEPLOY_BLURB).toMatch(/не публикация на хост/i);
    expect(LANDING_MCP_BLURB).toMatch(/GitHub/i);
    expect(LANDING_MCP_BLURB).toMatch(/не подключ/i);
    expect(LANDING_MONETIZE_BLURB).toMatch(/карточная сеть не подключена/i);
    expect(LANDING_CHAT_MOCK_PILL).toMatch(/симуляц/i);
    expect(LANDING_CHAT_MOCK_PILL).not.toMatch(/продаж/i);
  });

  test("chat mock is labeled as a mock", () => {
    expect(LANDING_CHAT_MOCK_LABEL).toMatch(/макет/i);
    expect(LANDING_CHAT_MOCK_LABEL).toMatch(/не живой чат/i);
  });
});
