import { describe, expect, test } from "bun:test";

import {
  coerceFindingsArray,
  parseAnalystFindings,
  quoteFromDocument,
} from "./finding-quotes";

const DOC = `### гл. 1
У Марины были зелёные глаза.
В гавани горел маяк.`;

describe("quoteFromDocument", () => {
  test("keeps a verbatim excerpt", () => {
    expect(quoteFromDocument("зелёные глаза", DOC)).toBe("зелёные глаза");
  });

  test("keeps a quote if only whitespace differs", () => {
    expect(quoteFromDocument("зелёные\nглаза", DOC)).toBe("зелёные глаза");
  });

  test("drops an invented quote", () => {
    expect(quoteFromDocument("у неё карие глаза и красный плащ", DOC)).toBeNull();
    expect(quoteFromDocument("  ", DOC)).toBeNull();
    expect(quoteFromDocument(null, DOC)).toBeNull();
  });
});

describe("parseAnalystFindings", () => {
  test("nulls quotes that are not in the document and keeps the title", () => {
    const drafts = parseAnalystFindings(
      [
        {
          type: "contradiction",
          severity: "critical",
          title: "Цвет глаз расходится",
          quote: "У Марины были зелёные глаза.",
          advice: "Сверить канон",
          sourceRef: "гл. 1",
        },
        {
          type: "omission",
          severity: "warning",
          title: "Плащ не описан",
          quote: "алый бархатный плащ из другой книги",
          advice: null,
        },
      ],
      DOC,
    );
    expect(drafts).toHaveLength(2);
    expect(drafts[0]!.quote).toBe("У Марины были зелёные глаза.");
    expect(drafts[1]!.quote).toBeNull();
    expect(drafts[1]!.title).toBe("Плащ не описан");
  });

  test("unwraps {findings:[]} and rejects a non-array as an error, not zero issues", () => {
    expect(parseAnalystFindings({ findings: [] }, DOC)).toEqual([]);
    expect(() => coerceFindingsArray({ error: "oops" })).toThrow(/массив находок/);
    expect(() => parseAnalystFindings("нет проблем", DOC)).toThrow(/массив находок/);
  });

  test("drops untitled rows and caps at 8", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      type: "inconsistency",
      title: i === 0 ? "" : `Находка ${i}`,
      quote: "маяк",
    }));
    expect(parseAnalystFindings(rows, DOC)).toHaveLength(8);
  });
});
