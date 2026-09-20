import { describe, expect, test } from "bun:test";

import type { DocumentDto } from "@/lib/workspace-types";

import {
  briefFromDocument,
  isPlanDocument,
  planFromDocument,
  sectionText,
} from "./plan-data";

function doc(partial: Partial<DocumentDto> & Pick<DocumentDto, "id">): DocumentDto {
  return {
    projectId: "ws",
    title: "План монетизации · маяк",
    description: "Бриф: детектив",
    kind: "spec",
    wordsCount: 40,
    updatedAt: new Date().toISOString(),
    sections: [],
    ...partial,
  };
}

describe("monetize planFromDocument persist parse", () => {
  test("isPlanDocument requires spec title prefix", () => {
    expect(isPlanDocument(doc({ id: "a" }))).toBe(true);
    expect(isPlanDocument(doc({ id: "b", kind: "manuscript" }))).toBe(false);
    expect(isPlanDocument(doc({ id: "c", title: "Рукопись" }))).toBe(false);
  });

  test("reload parse keeps products, steps, forecast — not Stripe copy", () => {
    const products = [{ name: "EP", price: "190 ₽", note: "стриминг" }];
    const parsed = planFromDocument(
      doc({
        id: "plan",
        sections: [
          {
            id: "s0",
            documentId: "plan",
            title: "Концепция",
            order: 0,
            status: "done",
            content: "Самиздат без эквайера.",
            wordsCount: 4,
            updatedAt: new Date().toISOString(),
          },
          {
            id: "s1",
            documentId: "plan",
            title: "Продукты и цены",
            order: 1,
            status: "done",
            content: `ПРОДУКТЫ_JSON:${JSON.stringify(products)}\n\n1. «EP» — 190 ₽`,
            wordsCount: 8,
            updatedAt: new Date().toISOString(),
          },
          {
            id: "s2",
            documentId: "plan",
            title: "Каналы",
            order: 2,
            status: "done",
            content: `КАНАЛЫ_JSON:${JSON.stringify([{ name: "Boosty", note: "подписка" }])}`,
            wordsCount: 3,
            updatedAt: new Date().toISOString(),
          },
          {
            id: "s3",
            documentId: "plan",
            title: "План запуска",
            order: 3,
            status: "done",
            content: `ШАГИ_JSON:${JSON.stringify([{ term: "Неделя 1", note: "свести EP" }])}`,
            wordsCount: 5,
            updatedAt: new Date().toISOString(),
          },
          {
            id: "s4",
            documentId: "plan",
            title: "Прогноз",
            order: 4,
            status: "done",
            content: `ПРОГНОЗ_JSON:${JSON.stringify({
              assumption: "без карты",
              monthly: [{ label: "Месяц 1", amount: 5000 }],
            })}`,
            wordsCount: 6,
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    );
    expect(parsed?.concept).toMatch(/самиздат/i);
    expect(parsed?.products[0]?.name).toBe("EP");
    expect(parsed?.channels[0]?.name).toBe("Boosty");
    expect(parsed?.steps[0]?.note).toMatch(/свести/i);
    expect(parsed?.forecast?.monthly[0]?.amount).toBe(5000);
    expect(JSON.stringify(parsed)).not.toMatch(/stripe/i);
    expect(briefFromDocument(doc({ id: "plan" }))).toBe("детектив");
    expect(sectionText("ПРОДУКТЫ_JSON:[]\n\n1. EP")).toBe("1. EP");
  });
});
