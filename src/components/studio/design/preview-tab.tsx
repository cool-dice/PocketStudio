"use client";

/**
 * Режим «Превью (IDE)» — курсор-стиль связки с кодом проекта.
 * Мок браузера с приложением-дашбордом: в режиме «Дизайнер» наведение
 * подсвечивает элемент и показывает его селектор, клик — выбирает
 * элемент в инспекторе (тег/класс, свойства, путь к файлу, промпт правки).
 */

import { useState } from "react";
import {
  Check,
  Copy,
  Eye,
  FileCode,
  Lock,
  Monitor,
  MousePointer2,
  Palette,
  RotateCw,
  Smartphone,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { DesignFile } from "./design-data";
import { IDE_ELEMENT_MAP, type IdeElement } from "./layout-data";
import { PreviewApp } from "./preview-app";
import { WipMiniBadge } from "./raster-panels";

type PreviewMode = "clean" | "design";
type Device = "desktop" | "mobile";

const MINI_TOOLS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: "select", name: "Выбрать", icon: MousePointer2 },
  { id: "text", name: "Текст", icon: Type },
  { id: "color", name: "Цвет", icon: Palette },
];

export function PreviewTab({ file }: { file: DesignFile }) {
  const [mode, setMode] = useState<PreviewMode>("design");
  const [device, setDevice] = useState<Device>("desktop");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [miniToolId, setMiniToolId] = useState("select");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const designer = mode === "design";
  const selected =
    Object.values(IDE_ELEMENT_MAP).find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Тумблер режимов */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card/50 px-3 py-2">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(v) => {
              if (v) setMode(v as PreviewMode);
            }}
            variant="outline"
            size="sm"
            aria-label="Режим превью"
          >
            <ToggleGroupItem value="clean">
              <Eye className="size-3.5" aria-hidden="true" />
              Предпросмотр
            </ToggleGroupItem>
            <ToggleGroupItem value="design">
              <MousePointer2 className="size-3.5" aria-hidden="true" />
              Дизайнер
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {designer
              ? "Наведите на элемент — появится путь к исходнику"
              : "Чистый предпросмотр приложения"}
          </span>
          <span className="max-w-40 truncate font-mono text-[10px] text-muted-foreground">
            {file.name}
          </span>
        </div>

        {/* Браузер */}
        <div
          className="relative flex min-h-[440px] flex-1 items-start justify-center overflow-auto p-3 sm:p-5"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(120,113,108,0.22) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-label="Окно предпросмотра"
        >
          <div className="relative w-full max-w-4xl overflow-hidden rounded-xl border bg-card shadow-2xl">
            {/* Хром браузера */}
            <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
              <span className="flex shrink-0 gap-1.5" aria-hidden="true">
                {["bg-stone-500/60", "bg-stone-400/50", "bg-stone-300/40"].map(
                  (dot, i) => (
                    <span key={i} className={cn("size-2.5 rounded-full", dot)} />
                  ),
                )}
              </span>
              <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5">
                <Lock className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  preview.localhost:3000
                </span>
                <RotateCw
                  className="ml-auto size-3 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <span className="flex shrink-0 items-center rounded-md border bg-background p-0.5" role="group" aria-label="Устройство">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-6",
                    device === "desktop" && "bg-primary/15 text-primary",
                  )}
                  onClick={() => setDevice("desktop")}
                  aria-label="Десктоп"
                  aria-pressed={device === "desktop"}
                >
                  <Monitor className="size-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-6",
                    device === "mobile" && "bg-primary/15 text-primary",
                  )}
                  onClick={() => setDevice("mobile")}
                  aria-label="Мобильный"
                  aria-pressed={device === "mobile"}
                >
                  <Smartphone className="size-3.5" aria-hidden="true" />
                </Button>
              </span>
            </div>

            {/* Вьюпорт с мок-приложением */}
            <div className="bg-muted/40 p-3 sm:p-4">
              <PreviewApp
                designer={designer}
                device={device}
                hoveredId={hoveredId}
                selectedId={selectedId}
                onHover={setHoveredId}
                onSelect={setSelectedId}
              />
            </div>

            {/* Плавающая мини-панель (только Дизайнер) */}
            {designer ? (
              <div
                role="toolbar"
                aria-label="Мини-инструменты дизайнера"
                className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 p-1 shadow-lg backdrop-blur"
              >
                {MINI_TOOLS.map((t) => (
                  <Button
                    key={t.id}
                    variant="ghost"
                    size="icon"
                    title={t.name}
                    aria-pressed={miniToolId === t.id}
                    aria-label={t.name}
                    onClick={() => setMiniToolId(t.id)}
                    className={cn(
                      "size-8 rounded-full",
                      miniToolId === t.id &&
                        "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    <t.icon className="size-4" aria-hidden="true" />
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Правая панель ── */}
      <aside
        aria-label="Инспектор превью"
        className="w-full shrink-0 border-t bg-card/50 md:w-80 md:border-l md:border-t-0"
      >
        {designer ? (
          selected ? (
            <IdeInspector
              element={selected}
              prompt={prompt}
              onPrompt={setPrompt}
              copied={copied}
              onCopy={() => setCopied((c) => !c)}
            />
          ) : (
            <EmptyPanel
              icon={MousePointer2}
              title="Кликните элемент в превью"
              description="В инспекторе появятся тег, класс, размеры, путь к файлу и поле промпт-правки."
            />
          )
        ) : (
          <>
            <EmptyPanel
              icon={Eye}
              title="Чистый предпросмотр"
              description="Переключитесь в режим «Дизайнер», чтобы выделять элементы и отправлять правки агенту."
            />
            <p className="rounded-lg border bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              {device === "desktop" ? "1440 × 900" : "390 × 844"}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

/* ── Инспектор выбранного элемента превью ── */

function IdeInspector({
  element,
  prompt,
  onPrompt,
  copied,
  onCopy,
}: {
  element: IdeElement;
  prompt: string;
  onPrompt: (v: string) => void;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="vf-scroll md:h-full md:overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <FileCode
          className="size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <code className="min-w-0 flex-1 truncate font-mono text-xs">
          &lt;{element.tag} class=&quot;{element.className}&quot;&gt;
        </code>
      </div>
      <dl className="px-4">
        <PropRow label="Размер" value={element.size} />
        <PropRow label="Цвет" value={element.color} swatch={element.color} />
        <PropRow label="Отступы" value={element.padding} />
      </dl>
      <div className="px-4 pt-3">
        <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Путь к файлу
        </p>
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <FileCode
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {element.filePath} : {element.line}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onCopy}
            aria-label="Скопировать путь к файлу"
          >
            {copied ? (
              <Check className="size-3.5 text-primary" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      <div className="space-y-2 px-4 pt-4 pb-5">
        <Label htmlFor="ide-prompt" className="text-xs">
          Опишите правку
        </Label>
        <Textarea
          id="ide-prompt"
          rows={3}
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          placeholder="Например: увеличь отступы в сайдбаре и сделай фон чуть темнее"
          className="resize-none text-xs"
        />
        <Button className="w-full gap-2">
          <Wand2 className="size-4" aria-hidden="true" />
          Применить через агента
          <WipMiniBadge />
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Агент получит элемент, файл и ваш комментарий — правка
          кода подключается на следующем этапе.
        </p>
      </div>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function PropRow({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b py-2 text-sm">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        {swatch ? (
          <span
            className="size-3.5 shrink-0 rounded-[4px] border"
            style={{ background: swatch }}
            aria-hidden="true"
          />
        ) : null}
        <span className="truncate font-mono text-xs">{value}</span>
      </dd>
    </div>
  );
}
