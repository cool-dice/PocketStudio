"use client";

/**
 * Config preview — dark monospace JSON example with syntax tints
 * (stone + emerald only) and a copy button.
 */

import { FileJson } from "lucide-react";

import { MCP_CONFIG_JSON } from "./mcp-data";
import { CopyButton } from "./mcp-bits";

/** Тонкая подсветка: ключи — emerald, строки — stone. */
const K = ({ children }: { children: React.ReactNode }) => (
  <span className="text-emerald-400">{children}</span>
);
const S = ({ children }: { children: React.ReactNode }) => (
  <span className="text-stone-300">{children}</span>
);

export function ConfigPreviewCard() {
  return (
    <section
      aria-label="Пример конфигурации MCP"
      className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <FileJson className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-tight">Пример конфигурации</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">mcp.json · stdio-транспорт</p>
        </div>
        <CopyButton text={MCP_CONFIG_JSON} label="Скопировать конфигурацию" className="shrink-0" />
      </header>

      <pre className="overflow-x-auto vf-scroll rounded-lg bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-500 selection:bg-emerald-500/30">
        <code>
          {"{\n"}
          {"  "}<K>&quot;mcpServers&quot;</K>: {"{"}\n
          {"    "}<K>&quot;github&quot;</K>: {"{ "}<K>&quot;command&quot;</K>: <S>&quot;npx&quot;</S>
          {", "}<K>&quot;args&quot;</K>: [<S>&quot;-y&quot;</S>, <S>&quot;@modelcontextprotocol/server-github&quot;</S>] {"},"}\n
          {"    "}<K>&quot;playwright&quot;</K>: {"{ "}<K>&quot;command&quot;</K>: <S>&quot;npx&quot;</S>
          {", "}<K>&quot;args&quot;</K>: [<S>&quot;-y&quot;</S>, <S>&quot;@playwright/mcp@latest&quot;</S>] {"}"}\n
          {"  "}{"}\n"}
          {"}"}
        </code>
      </pre>

      <p className="mt-2.5 text-xs text-muted-foreground">
        Конфигурация хранится в профиле студии
      </p>
    </section>
  );
}
