"use client";

/**
 * ToolsScreen — «Инструменты» (PS-3-d).
 *
 * Глобальный уровень Инструментов поверх воркспейсов: Скиллы,
 * Интеграции, Монетизация (сводка) и Админ — существующие экраны
 * студии, встроенные во внутренние под-вкладки со своими
 * заголовками и внутренними скроллами (рамка WorkspaceModuleFrame).
 * Админ закрыт для не-администраторов дружелюбной карточкой-замком.
 */

import { useState } from "react";
import {
  Blocks,
  Coins,
  KeyRound,
  ShieldCheck,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { AdminScreen } from "@/components/app/admin-screen";
import { AiSettingsScreen } from "@/components/app/ai-settings-screen";
import { McpScreen } from "@/components/studio/mcp/mcp-screen";
import { MonetizeScreen } from "@/components/studio/monetize/monetize-screen";
import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { SkillsScreen } from "@/components/studio/skills/skills-screen";
import { WorkspaceModuleFrame } from "@/components/workspaces/workspace-tabs-ui";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

type ToolsTabValue = "skills" | "integrations" | "models" | "monetize" | "admin";

const TOOL_TABS: { value: ToolsTabValue; label: string; icon: LucideIcon }[] = [
  { value: "skills", label: "Скиллы", icon: Wand2 },
  { value: "integrations", label: "Интеграции", icon: Blocks },
  { value: "models", label: "Модели ИИ", icon: KeyRound },
  { value: "monetize", label: "Монетизация", icon: Coins },
  { value: "admin", label: "Админ", icon: ShieldCheck },
];

/** Дружелюбный замок для не-администраторов (роль из useAuth). */
function AdminLockedCard({ role }: { role: string | null }) {
  const roleLabel = role === "admin" ? "админ" : role === "client" ? "клиент" : "гость";
  return (
    <div className="vf-scroll flex h-full min-h-0 items-center justify-center overflow-y-auto p-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-xl border bg-muted/50 text-muted-foreground"
        >
          <ShieldCheck className="size-6" />
        </span>
        <p className="text-sm font-semibold">
          Раздел только для администраторов
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Админ-панель управляет пользователями, ролями и аудитом событий
          студии. Ваша текущая роль — «{roleLabel}», поэтому вкладка закрыта.
        </p>
        <Badge
          variant="outline"
          className="gap-1.5 text-muted-foreground"
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          нужен доступ уровня «админ»
        </Badge>
      </div>
    </div>
  );
}

export function ToolsScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [tab, setTab] = useState<ToolsTabValue>("skills");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ModuleHeader
        icon={Wrench}
        title="Инструменты"
        description="Скиллы, интеграции, модели ИИ, монетизация и администрирование"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ToolsTabValue)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        {/* ── Под-навигация инструментов ── */}
        <div className="shrink-0 border-b bg-background px-3 py-2 sm:px-4">
          <TabsList className="vf-scroll-x h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {TOOL_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs data-[state=active]:bg-accent sm:text-sm"
              >
                <t.icon className="size-3.5 shrink-0" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ── Скиллы ── */}
        <TabsContent value="skills" className="mt-0 min-h-0 flex-1">
          <WorkspaceModuleFrame>
            <SkillsScreen onOpenMobileNav={onOpenMobileNav} />
          </WorkspaceModuleFrame>
        </TabsContent>

        {/* ── Интеграции ── */}
        <TabsContent value="integrations" className="mt-0 min-h-0 flex-1">
          <WorkspaceModuleFrame>
            <McpScreen onOpenMobileNav={onOpenMobileNav} />
          </WorkspaceModuleFrame>
        </TabsContent>

        {/* ── Модели ИИ ── */}
        <TabsContent value="models" className="mt-0 min-h-0 flex-1">
          <WorkspaceModuleFrame>
            <AiSettingsScreen onOpenMobileNav={onOpenMobileNav} />
          </WorkspaceModuleFrame>
        </TabsContent>

        {/* ── Монетизация (глобальная сводка) ── */}
        <TabsContent value="monetize" className="mt-0 min-h-0 flex-1">
          <WorkspaceModuleFrame>
            <MonetizeScreen onOpenMobileNav={onOpenMobileNav} />
          </WorkspaceModuleFrame>
        </TabsContent>

        {/* ── Админ (только для администраторов) ── */}
        <TabsContent value="admin" className="mt-0 min-h-0 flex-1">
          {isAdmin ? (
            <WorkspaceModuleFrame>
              <AdminScreen onOpenMobileNav={onOpenMobileNav} />
            </WorkspaceModuleFrame>
          ) : (
            <AdminLockedCard role={user?.role ?? null} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
