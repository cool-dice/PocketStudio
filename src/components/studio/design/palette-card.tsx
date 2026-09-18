"use client";

/**
 * PaletteCard (Фаза A) — карта палитры стиля на живых данных:
 * mood-строка, сетка свотчей (клик — копия HEX в буфер + toast),
 * превью пары шрифтов системными стеками и жирностями,
 * совет арт-директора и честная подпись о происхождении.
 */

import { Lightbulb, Palette as PaletteIcon, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isHexDark, looksSerif, type StylePalette } from "@/lib/palette";
import { formatBoardDate } from "./palette-data";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* фолбэк ниже */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function PaletteCard({
  palette,
  createdAt,
  brief,
}: {
  palette: StylePalette;
  createdAt?: string;
  brief?: string | null;
}) {
  const { mood, colors, fonts, advice } = palette;

  const copyHex = async (hex: string, name: string) => {
    const ok = await copyText(hex);
    if (ok) {
      toast.success(`${hex} скопирован`, { description: name });
    } else {
      toast.error("Не удалось скопировать", {
        description: `Скопируйте вручную: ${hex}`,
      });
    }
  };

  return (
    <article
      aria-label="Палитра стиля"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-6"
    >
      {/* Шапка: настроение палитры */}
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <PaletteIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold">Палитра стиля</h3>
            {createdAt ? (
              <span className="text-xs text-muted-foreground">
                собрана {formatBoardDate(createdAt)}
              </span>
            ) : null}
          </div>
          {mood ? (
            <p className="mt-1 text-base leading-snug font-medium text-primary">
              «{mood}»
            </p>
          ) : null}
        </div>
      </div>

      {/* Свотчи: клик — копия HEX */}
      <div
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        role="group"
        aria-label={`Цвета палитры, ${colors.length} шт.`}
      >
        {colors.map((c) => {
          const dark = isHexDark(c.hex);
          return (
            <Button
              key={c.hex + c.name}
              type="button"
              variant="ghost"
              onClick={() => void copyHex(c.hex, c.name)}
              aria-label={`Скопировать цвет ${c.name} — ${c.hex}`}
              title={`Скопировать ${c.hex}`}
              className="group h-auto flex-col items-stretch gap-0 rounded-lg p-0 text-left focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="flex aspect-[4/3] items-end justify-between rounded-lg border border-black/10 p-2 dark:border-white/10"
                style={{ backgroundColor: c.hex }}
              >
                <span
                  className={cn(
                    "font-mono text-[11px] font-semibold tabular-nums",
                    dark ? "text-white" : "text-stone-900",
                  )}
                >
                  {c.hex}
                </span>
              </span>
              <span className="mt-1.5 w-full truncate px-0.5 text-xs font-medium">
                {c.name}
              </span>
              {c.usage ? (
                <span className="line-clamp-2 w-full px-0.5 text-left text-[11px] leading-snug text-muted-foreground">
                  {c.usage}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {/* Пара шрифтов: превью типографикой */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Заголовки · {fonts.heading || "—"}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl leading-tight font-bold tracking-tight",
              looksSerif(fonts.heading) ? "font-serif" : "font-sans",
            )}
          >
            Студия в кармане
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            системный стек · толщина 700
          </p>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Текст · {fonts.body || "—"}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Идея живёт в деталях: короткие абзацы, ровный ритм строк и
            достаточно воздуха вокруг смысла.
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            системный стек · толщина 400
          </p>
        </div>
      </div>
      {fonts.note ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          О паре: {fonts.note}
        </p>
      ) : null}

      {/* Совет арт-директора */}
      {advice ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5">
          <Lightbulb
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed">{advice}</p>
        </div>
      ) : null}

      {/* Бриф, на котором собрана палитра */}
      {brief ? (
        <p
          className="mt-3 text-xs leading-relaxed text-muted-foreground"
          title={brief}
        >
          <span className="font-medium">Бриф:</span>{" "}
          <span className="line-clamp-2">{brief}</span>
        </p>
      ) : null}

      {/* Честная подпись */}
      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Палитра — рекомендация модели, hex копируется кликом
      </p>
    </article>
  );
}
