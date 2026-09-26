"use client";

/**
 * Плавающий помощник у выделения в главе. Инструкция и фрагмент уходят
 * в тот же шлюз, что и «ИИ-правка главы» (`rewrite_section`). В текст
 * подставляется только ответ модели — остальная глава не трогается.
 * Диапазон запоминается до отправки: фокус в поле не должен его потерять.
 */

import { Loader2, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  clampFloater,
  replaceTextRange,
  selectionReplacementFromModel,
  selectionTargetFromRange,
} from "@/lib/selection-rewrite";
import { SECTION_AI_FAILED, SECTION_AI_UNCONFIGURED_HINT } from "@/lib/studio-copy";

type SelectionTarget = { start: number; end: number; text: string };

const MIRROR_PROPS = [
  "boxSizing",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textIndent",
  "wordSpacing",
] as const;

function textareaCaretViewport(
  el: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } {
  const cs = getComputedStyle(el);
  const div = document.createElement("div");
  div.setAttribute("aria-hidden", "true");
  const style = div.style;
  style.position = "absolute";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.overflowWrap = "break-word";
  style.overflow = "hidden";
  style.top = "0";
  style.left = "-9999px";
  style.width = `${el.offsetWidth}px`;
  const mirror = style as CSSStyleDeclaration & Record<string, string>;
  const computed = cs as CSSStyleDeclaration & Record<string, string>;
  for (const prop of MIRROR_PROPS) {
    mirror[prop] = computed[prop] ?? "";
  }
  div.textContent = el.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = el.value.slice(position, position + 1) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft - el.scrollLeft;
  div.remove();
  const rect = el.getBoundingClientRect();
  return { top: rect.top + top, left: rect.left + left };
}

function revealCaret(el: HTMLTextAreaElement, position: number): void {
  const point = textareaCaretViewport(el, position);
  const scroller = el.closest(".vf-scroll");
  if (!(scroller instanceof HTMLElement)) return;
  const rect = scroller.getBoundingClientRect();
  const topBound = rect.top + 36;
  const bottomBound = Math.min(rect.bottom, window.innerHeight) - 150;
  if (point.top >= topBound && point.top <= bottomBound) return;
  scroller.scrollTop += point.top - (rect.top + 96);
}

function excerptOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  return `${flat.slice(0, 157)}…`;
}

function writeRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  replacement: string,
): void {
  const before = el.value;
  const expected = before.slice(0, start) + replacement + before.slice(end);
  el.focus();
  el.setSelectionRange(start, end);
  document.execCommand("insertText", false, replacement);
  if (el.value === expected) return;
  if (el.value !== before) el.value = before;
  el.setRangeText(replacement, start, end, "end");
}

export function SelectionChat({
  textareaRef,
  sectionId,
  onReplace,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  sectionId: string;
  onReplace: (value: string) => void;
}) {
  const [target, setTarget] = useState<SelectionTarget | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const floaterRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<SelectionTarget | null>(null);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  targetRef.current = target;

  const dismiss = useCallback(() => {
    requestId.current += 1;
    busyRef.current = false;
    setBusy(false);
    setTarget(null);
    setError(null);
    setInstruction("");
  }, []);

  useEffect(() => {
    requestId.current += 1;
    busyRef.current = false;
    setBusy(false);
    setTarget(null);
    setError(null);
    setInstruction("");
  }, [sectionId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const publish = (next: SelectionTarget | null) => {
      if (busyRef.current) return;
      setTarget(next);
      if (next) setError(null);
    };
    const read = () => {
      const node = textareaRef.current;
      if (!node) return null;
      return selectionTargetFromRange(
        node.value,
        node.selectionStart ?? 0,
        node.selectionEnd ?? 0,
      );
    };
    const onSelect = () => {
      const next = read();
      if (next) publish(next);
    };
    const onEditorGesture = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") return;
      const node = textareaRef.current;
      if (!node || document.activeElement !== node) return;
      publish(read());
    };

    el.addEventListener("select", onSelect);
    el.addEventListener("mouseup", onEditorGesture);
    el.addEventListener("keyup", onEditorGesture);
    return () => {
      el.removeEventListener("select", onSelect);
      el.removeEventListener("mouseup", onEditorGesture);
      el.removeEventListener("keyup", onEditorGesture);
    };
  }, [textareaRef, sectionId]);

  useEffect(() => {
    if (!target) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target;
      if (!(node instanceof Node)) return;
      if (floaterRef.current?.contains(node)) return;
      if (textareaRef.current?.contains(node)) return;
      dismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [target, dismiss, textareaRef]);

  useEffect(() => {
    if (!target) return;
    const bump = () => setTick((n) => n + 1);
    document.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    return () => {
      document.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    };
  }, [target]);

  useLayoutEffect(() => {
    if (!target) return;
    const el = textareaRef.current;
    if (el) revealCaret(el, target.end);
    setTick((n) => n + 1);
  }, [target, textareaRef]);

  const pos = useMemo(() => {
    if (!target || typeof window === "undefined") return null;
    const el = textareaRef.current;
    if (!el) return null;
    const anchor = textareaCaretViewport(el, target.end);
    const box = floaterRef.current;
    return clampFloater({
      anchorTop: anchor.top,
      anchorLeft: anchor.left,
      width: box?.offsetWidth || 352,
      height: box?.offsetHeight || 148,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, [target, tick, textareaRef]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const pinned = targetRef.current;
    const instructionText = instruction.trim();
    if (!pinned || busyRef.current) return;
    if (instructionText.length < 1) {
      toast.error("Напишите, как изменить выделенный фрагмент");
      return;
    }
    const id = ++requestId.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const raw = await api.aiRewriteSelection({
        sectionId,
        selection: pinned.text,
        instruction: instructionText,
      });
      if (id !== requestId.current) return;
      const replacement = selectionReplacementFromModel(raw);
      const el = textareaRef.current;
      if (!replacement || !el) {
        setError("Модель вернула пустой фрагмент — выделение на месте");
        toast.error(SECTION_AI_FAILED);
        return;
      }
      if (el.value.slice(pinned.start, pinned.end) !== pinned.text) {
        toast.error("Выделение изменилось — выделите фрагмент ещё раз");
        setTarget(null);
        return;
      }
      const next = replaceTextRange(el.value, pinned.start, pinned.end, replacement);
      if (next == null) {
        toast.error(SECTION_AI_FAILED);
        return;
      }
      writeRange(el, pinned.start, pinned.end, replacement);
      revealCaret(el, pinned.start);
      onReplace(el.value);
      toast.success("Фрагмент изменён", {
        description: "Остальной текст главы на месте.",
      });
      setInstruction("");
      setTarget(null);
    } catch (err) {
      if (id !== requestId.current) return;
      const unconfigured =
        err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
      const message = unconfigured ? UNCONFIGURED_TOOL_MESSAGE : SECTION_AI_FAILED;
      const hint = unconfigured ? SECTION_AI_UNCONFIGURED_HINT : undefined;
      setError(hint ? `${message} ${hint}` : message);
      toast.error(message, { description: hint });
    } finally {
      if (id === requestId.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  if (!target || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={floaterRef}
      role="dialog"
      aria-label="Правка выделения"
      data-selection-chat=""
      className="fixed z-30 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border bg-card p-3 text-card-foreground shadow-lg"
      style={{ top: pos.top, left: pos.left }}
      onPointerDown={(event) => {
        const node = event.target;
        if (!(node instanceof Element)) return;
        if (node.closest("button, input, textarea")) return;
        event.preventDefault();
      }}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">Правка выделения</p>
          <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground">
            {excerptOf(target.text)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <form className="mt-2 flex items-center gap-1.5" onSubmit={(event) => void submit(event)}>
        <label htmlFor="selection-chat-instruction" className="sr-only">
          Как изменить выделенный фрагмент
        </label>
        <Input
          id="selection-chat-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }}
          disabled={busy}
          maxLength={2000}
          autoComplete="off"
          placeholder="Как изменить? Например: сделай короче"
          className="h-8 min-w-0 text-xs"
        />
        <Button type="submit" size="sm" disabled={busy} className="shrink-0">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Правим…" : "Изменить"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-[11px] leading-snug text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Заменится только выделенный фрагмент.
        </p>
      )}
    </div>,
    document.body,
  );
}
