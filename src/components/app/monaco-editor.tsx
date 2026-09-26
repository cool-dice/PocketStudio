"use client";

/**
 * MonacoEditor — thin wrapper around @monaco-editor/react with the LOCAL
 * bundle (public/monaco/vs, no CDN), theme synced with next-themes
 * (vs-dark / vs) and the app's editor defaults (no minimap, 13px, wrap).
 * A skeleton fills the area while Monaco boots (dynamic, no SSR).
 */

import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import { useTheme } from "next-themes";

import { Skeleton } from "@/components/ui/skeleton";

// Local bundle — runs before any <Editor> instance mounts.
loader.config({ paths: { vs: "/monaco/vs" } });

const Editor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  { ssr: false },
);

function EditorSkeleton() {
  return (
    <div className="h-full w-full p-4" aria-label="Загрузка редактора">
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}

export interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function MonacoEditor({ value, language, onChange, readOnly }: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

  return (
    <Editor
      value={value}
      language={language}
      theme={monacoTheme}
      height="100%"
      loading={<EditorSkeleton />}
      onChange={(next) => onChange?.(next ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: "selection",
        readOnly: readOnly ?? false,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        padding: { top: 12, bottom: 12 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  );
}
