/**
 * Analyst drafts: quotes must appear in the document text.
 * Invented quotes become null — the finding itself is kept only if it has a title.
 * A non-array model reply is an error, not “zero issues”.
 */

export type AnalystFindingType = "contradiction" | "omission" | "inconsistency";
export type AnalystFindingSeverity = "info" | "warning" | "critical";

export interface AnalystFindingDraft {
  type: AnalystFindingType;
  severity: AnalystFindingSeverity;
  title: string;
  quote: string | null;
  advice: string | null;
  sourceRef: string | null;
}

const TYPES: AnalystFindingType[] = [
  "contradiction",
  "omission",
  "inconsistency",
];
const SEVERITIES: AnalystFindingSeverity[] = ["info", "warning", "critical"];

export function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Keep the quote only when it occurs in the document (whitespace-tolerant). */
export function quoteFromDocument(
  quote: string | null | undefined,
  documentText: string,
): string | null {
  if (quote == null) return null;
  const raw = quote.trim();
  if (!raw) return null;
  if (documentText.includes(raw)) return raw.slice(0, 600);
  const collapsedQuote = collapseWs(raw);
  const collapsedDoc = collapseWs(documentText);
  if (collapsedQuote && collapsedDoc.includes(collapsedQuote)) {
    return collapsedQuote.slice(0, 600);
  }
  return null;
}

export function coerceFindingsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (
    raw !== null &&
    typeof raw === "object" &&
    Array.isArray((raw as { findings?: unknown }).findings)
  ) {
    return (raw as { findings: unknown[] }).findings;
  }
  throw new Error("Модель не вернула JSON-массив находок");
}

export function parseAnalystFindings(
  raw: unknown,
  documentText: string,
): AnalystFindingDraft[] {
  const rows = coerceFindingsArray(raw);
  return rows
    .filter((row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null,
    )
    .map((row) => {
      const type = String(row.type);
      const severity = String(row.severity);
      return {
        type: (TYPES.includes(type as AnalystFindingType)
          ? type
          : "inconsistency") as AnalystFindingType,
        severity: (SEVERITIES.includes(severity as AnalystFindingSeverity)
          ? severity
          : "warning") as AnalystFindingSeverity,
        title: String(row.title ?? "").slice(0, 300),
        quote: quoteFromDocument(
          row.quote == null ? null : String(row.quote),
          documentText,
        ),
        advice: row.advice ? String(row.advice).slice(0, 600) : null,
        sourceRef: row.sourceRef ? String(row.sourceRef).slice(0, 200) : null,
      };
    })
    .filter((row) => row.title.length > 0)
    .slice(0, 8);
}
