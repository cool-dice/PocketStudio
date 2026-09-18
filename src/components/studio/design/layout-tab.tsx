"use client";

/**
 * Режим «Макет» — упрощённый Figma.
 * Фреймы-наброски лендинга (десктоп + мобайл), дерево слоёв, инспектор.
 * Все правки локальные: инспектор реально двигает/перекрашивает элементы.
 */

import { useMemo, useState } from "react";
import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Component,
  Frame as FrameIcon,
  Monitor,
  Plus,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type DesignFile } from "./design-data";
import {
  COMPONENT_ITEMS,
  DESKTOP_FRAME,
  MOBILE_FRAME,
  type LayoutFrame,
  type LayoutNode,
  type NodeKind,
} from "./layout-data";
import { FrameView, NODE_ICONS } from "./layout-frame";
import { LayoutInspector } from "./layout-inspector";

const PAGES = [
  { id: "desktop", label: "Десктоп", icon: Monitor },
  { id: "mobile", label: "Мобайл", icon: Smartphone },
  { id: "components", label: "Компоненты", icon: Component },
] as const;

type PageId = (typeof PAGES)[number]["id"];

export function LayoutTab({ file }: { file: DesignFile }) {
  const [frames, setFrames] = useState<LayoutFrame[]>([
    DESKTOP_FRAME,
    MOBILE_FRAME,
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("hero");
  const [pageId, setPageId] = useState<PageId>("desktop");

  const selectedNode = useMemo(
    () =>
      frames.flatMap((f) => f.nodes).find((n) => n.id === selectedNodeId) ??
      null,
    [frames, selectedNodeId],
  );

  const frameOfSelected = useMemo(
    () => frames.find((f) => f.nodes.some((n) => n.id === selectedNodeId)) ?? null,
    [frames, selectedNodeId],
  );

  const totalNodes = frames.reduce((sum, f) => sum + f.nodes.length, 0);

  /* ── Правки элемента из инспектора ── */
  const updateNode = (id: string, patch: Partial<LayoutNode>) =>
    setFrames((prev) =>
      prev.map((f) => ({
        ...f,
        nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      })),
    );

  const alignSelected = (dir: "left" | "center" | "right") => {
    if (!selectedNode || !frameOfSelected) return;
    updateNode(selectedNode.id, {
      x:
        dir === "left"
          ? 24
          : dir === "center"
            ? Math.round((frameOfSelected.width - selectedNode.w) / 2)
            : frameOfSelected.width - selectedNode.w - 24,
    });
  };

  /* ── Добавление компонента на десктоп-фрейм ── */
  const addComponent = (item: (typeof COMPONENT_ITEMS)[number]) => {
    const id = `${item.kind}-${Date.now().toString(36)}`;
    setFrames((prev) =>
      prev.map((f) => {
        if (f.id !== "desktop") return f;
        const y = f.height + 32;
        const sameKind = f.nodes.filter((n) => n.kind === item.kind).length;
        const node: LayoutNode = {
          id,
          name: sameKind > 0 ? `${item.name} ${sameKind + 1}` : item.name,
          tag: item.kind === "input" ? "input" : "div",
          kind: item.kind,
          x: Math.round((f.width - item.w) / 2),
          y,
          w: item.w,
          h: item.h,
          fill: item.fill,
          radius: 12,
          shadow: false,
          shadowBlur: 0,
        };
        return { ...f, height: y + item.h, nodes: [...f.nodes, node] };
      }),
    );
    setSelectedNodeId(id);
    setPageId("desktop");
  };

  const nodeIcon = (kind: NodeKind) => NODE_ICONS[kind];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* ── Слева: страницы/фреймы + дерево слоёв ── */}
      <aside
        aria-label="Страницы и слои макета"
        className="w-full shrink-0 border-b bg-card/40 md:w-56 md:border-r md:border-b-0"
      >
        <div className="vf-scroll md:h-full md:overflow-y-auto">
          <section aria-label="Страницы и фреймы" className="p-2">
            <h3 className="px-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Страницы / Фреймы
            </h3>
            <ul className="space-y-0.5">
              {PAGES.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => setPageId(page.id)}
                    aria-current={pageId === page.id ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                      pageId === page.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/90 hover:bg-accent/60",
                    )}
                  >
                    <page.icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{page.label}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {page.id === "desktop"
                        ? frames[0]?.nodes.length
                        : page.id === "mobile"
                          ? frames[1]?.nodes.length
                          : COMPONENT_ITEMS.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <span
            className="my-2 block h-px w-full bg-border"
            aria-hidden="true"
          />

          <section aria-label="Слои макета" className="p-2">
            <h3 className="px-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Слои
            </h3>
            <ul className="space-y-0.5">
              {frames.map((frame) => (
                <li key={frame.id}>
                  <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                    <FrameIcon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {frame.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {frame.width}×{frame.height}
                    </span>
                  </div>
                  <ul className="mt-0.5 space-y-0.5 border-l pl-3">
                    {frame.nodes.map((node) => {
                      const Icon = nodeIcon(node.kind);
                      const active = node.id === selectedNodeId;
                      return (
                        <li key={node.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedNodeId(node.id);
                              setPageId(frame.id === "mobile" ? "mobile" : "desktop");
                            }}
                            aria-current={active ? "true" : undefined}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                              active
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-foreground/80 hover:bg-accent/60",
                            )}
                          >
                            <Icon className="size-3 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-left">
                              {node.name}
                            </span>
                            <code className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
                              {node.tag}
                            </code>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>

      {/* ── Центр: панель инструментов + холст с фреймами ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-card/50 px-3 py-2">
          <span className="mr-1 hidden text-[11px] text-muted-foreground sm:inline">
            Выравнивание
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => alignSelected("left")}
            disabled={!selectedNode}
            aria-label="Прижать выбранный элемент влево"
          >
            <AlignLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => alignSelected("center")}
            disabled={!selectedNode}
            aria-label="Выровнять выбранный элемент по центру"
          >
            <AlignCenter className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => alignSelected("right")}
            disabled={!selectedNode}
            aria-label="Прижать выбранный элемент вправо"
          >
            <AlignRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled
            title="Мультивыбор — в разработке"
            aria-label="Распределить (в разработке)"
          >
            <AlignHorizontalSpaceAround className="size-4" aria-hidden="true" />
          </Button>
          <span
            className="mx-1 h-5 w-px shrink-0 self-center bg-border"
            aria-hidden="true"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Component className="size-4" aria-hidden="true" />
                Компоненты
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Добавить на десктоп-фрейм</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COMPONENT_ITEMS.map((item) => {
                const Icon = NODE_ICONS[item.kind];
                return (
                  <DropdownMenuItem
                    key={item.kind}
                    onSelect={() => addComponent(item)}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {item.name}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {item.w}×{item.h}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {file.name} · элементов: {totalNodes}
          </span>
        </div>

        {/* Холст */}
        <div
          className="relative min-h-[380px] flex-1 overflow-auto p-4 sm:p-6 md:h-auto md:min-h-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(120,113,108,0.35) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-label="Холст макета"
        >
          <div className="flex min-h-full flex-wrap items-start justify-center gap-x-8 gap-y-6">
            {frames.map((frame) => (
              <FrameView
                key={frame.id}
                frame={frame}
                selectedId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            ))}
            {/* Плашка-подсказка о добавлении */}
            <div className="flex h-24 w-64 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground/70">
              <Plus className="size-4" aria-hidden="true" />
              <p className="text-[11px]">
                Компоненты добавляются в меню выше
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Справа: инспектор ── */}
      <aside
        aria-label="Инспектор макета"
        className="w-full shrink-0 border-t bg-card/50 md:w-72 md:border-l md:border-t-0"
      >
        <div className="md:h-full">
          <LayoutInspector
            node={selectedNode}
            frame={frameOfSelected}
            onChange={(patch) =>
              selectedNode ? updateNode(selectedNode.id, patch) : undefined
            }
            onAlign={alignSelected}
          />
        </div>
      </aside>
    </div>
  );
}
