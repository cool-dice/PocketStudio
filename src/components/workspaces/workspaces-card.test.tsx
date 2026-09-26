import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspacesCard } from "./workspaces-card";
import type { WorkspaceDto } from "@/lib/workspace-types";

const workspace: WorkspaceDto = {
  id: "ws-1",
  type: "film",
  name: "Смешной ролик",
  description: "Короткий скетч",
  origin: "manual",
  stage: "Сценарий",
  stageIndex: 0,
  progress: 12,
  favorite: false,
  archived: false,
  counts: {
    notes: 1,
    documents: 0,
    images: 0,
    audio: 0,
    video: 0,
    files: 0,
  },
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

/** Глубина вложенности <button>. HTML запрещает button внутри button. */
function maxButtonDepth(html: string): number {
  const tokens = html.match(/<\/?button\b[^>]*>/gi) ?? [];
  let depth = 0;
  let max = 0;
  for (const token of tokens) {
    if (/^<\//.test(token)) {
      depth -= 1;
    } else {
      depth += 1;
      max = Math.max(max, depth);
    }
  }
  expect(depth).toBe(0);
  return max;
}

describe("WorkspacesCard markup", () => {
  test("favorite control is a sibling of the cover button", () => {
    const html = renderToStaticMarkup(
      <WorkspacesCard
        workspace={workspace}
        onOpen={() => {}}
        onToggleFavorite={() => {}}
      />,
    );

    expect(maxButtonDepth(html)).toBe(1);
    expect(html).toContain('aria-label="Открыть воркспейс «Смешной ролик»"');
    expect(html).toContain('aria-label="В избранное"');
    expect(html).toContain('aria-pressed="false"');
  });

  test("favorite state is pressed when the workspace is starred", () => {
    const html = renderToStaticMarkup(
      <WorkspacesCard
        workspace={{ ...workspace, favorite: true }}
        onOpen={() => {}}
        onToggleFavorite={() => {}}
      />,
    );

    expect(maxButtonDepth(html)).toBe(1);
    expect(html).toContain('aria-label="Убрать из избранного"');
    expect(html).toContain('aria-pressed="true"');
  });

  test("omits the favorite button when the handler is absent", () => {
    const html = renderToStaticMarkup(
      <WorkspacesCard workspace={workspace} onOpen={() => {}} />,
    );

    expect(maxButtonDepth(html)).toBe(1);
    expect(html).not.toContain("В избранное");
  });
});
