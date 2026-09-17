"use client";

/**
 * MonacoDiff — thin wrapper around @monaco-editor/react's <DiffEditor> with
 * the LOCAL bundle (configured by the MonacoEditor module — import it first
 * so loader.config runs before mounting), theme synced with next-themes and
 * read-only side-by-side defaults (renderSideBySide always on, word wrap).
 */

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";

// Side-effect import: configures the local /monaco/vs loader path
// (loader.config runs at monaco-editor module scope).
import "@/components/app/monaco-editor";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false },
);

function DiffSkeleton() {
  return (
    <div className="h-full w-full p-4" aria-label="Загрузка diff">
      <div className="space-y-3">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export interface MonacoDiffProps {
  original: string;
  modified: string;
  language: string;
  /** Side-by-side (default) or inline diff. */
  inline?: boolean;
}

export function MonacoDiff({ original, modified, language, inline }: MonacoDiffProps) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme={monacoTheme}
      height="100%"
      loading={<DiffSkeleton />}
      options={{
        readOnly: true,
        renderSideBySide: !inline,
        minimap: { enabled: false },
        fontSize: 12.5,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderOverviewRuler: false,
        diffWordWrap: "off",
        ignoreTrimWhitespace: false,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        padding: { top: 10, bottom: 10 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        renderWhitespace: "selection",
      }}
    />
  );
}
