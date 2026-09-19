"use client";

import { useEffect, useState } from "react";
import { MousePointerClick, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppUi } from "@/lib/store";

export interface InspectHit {
  selector: string;
  tag: string;
  id: string | null;
  className: string | null;
  text: string;
}

export function PreviewInspector({
  iframeSrc,
  projectName,
}: {
  iframeSrc: string;
  projectName: string;
}) {
  const [hit, setHit] = useState<InspectHit | null>(null);
  const [instruction, setInstruction] = useState("");
  const setComposerDraft = useAppUi((s) => s.setComposerDraft);
  const setMainArea = useAppUi((s) => s.setMainArea);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } & Partial<InspectHit>;
      if (data?.type !== "pocketstudio-inspect") return;
      if (!data.selector || !data.tag) return;
      setHit({
        selector: data.selector,
        tag: data.tag,
        id: data.id ?? null,
        className: data.className ?? null,
        text: data.text ?? "",
      });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function askAgent() {
    if (!hit) return;
    const body = [
      `В превью «${projectName}» кликнули элемент ${hit.selector} (<${hit.tag}>).`,
      hit.text ? `Текст: «${hit.text.slice(0, 160)}».` : "",
      instruction.trim()
        ? `Правка: ${instruction.trim()}`
        : "Поправь внешний вид или разметку этого элемента (apply_patch по HTML/CSS).",
    ]
      .filter(Boolean)
      .join(" ");
    setComposerDraft(body);
    setMainArea("chat");
  }

  function reloadFrame() {
    const frame = document.querySelector<HTMLIFrameElement>(
      'iframe[title="Превью проекта"]',
    );
    frame?.contentWindow?.postMessage({ type: "pocketstudio-reload" }, "*");
    if (frame) frame.src = `${iframeSrc}${iframeSrc.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }

  return (
    <aside className="flex w-full flex-col gap-2 border-t pt-3 md:w-64 md:border-l md:border-t-0 md:pl-3 md:pt-0">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <MousePointerClick className="size-3.5" aria-hidden="true" />
        Инспектор
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Клик по элементу в превью — курсор-стиль. Статический HTML, не hot-reload
        dev-сервера.
      </p>
      {hit ? (
        <div className="rounded-lg border bg-muted/40 p-2 text-[11px]">
          <p className="font-mono break-all">{hit.selector}</p>
          {hit.text ? (
            <p className="mt-1 line-clamp-3 text-muted-foreground">{hit.text}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Пока ничего не выбрано.</p>
      )}
      <Textarea
        rows={3}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Что поменять в этом элементе…"
        className="resize-none text-xs"
        aria-label="Инструкция правки элемента"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!hit} onClick={askAgent}>
          Попросить агента
        </Button>
        <Button size="sm" variant="outline" onClick={reloadFrame}>
          <RefreshCw className="size-3.5" /> Обновить
        </Button>
      </div>
    </aside>
  );
}
