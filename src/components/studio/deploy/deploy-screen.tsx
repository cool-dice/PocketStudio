"use client";

/**
 * DeployScreen — экран «Деплой» карманной студии.
 * Пайплайн сборки → журнал → хосты → история → переменные окружения.
 * Чистый визуальный мок: локальное состояние, без сети.
 */

import { motion } from "framer-motion";
import { Loader2, Rocket, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ModuleHeader,
  WipBanner,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { BuildLogCard } from "./build-log-card";
import { EnvVarsCard } from "./env-vars-card";
import { HostsSection } from "./hosts-section";
import { DeployHistoryTable } from "./deploy-history-table";
import { PipelineCard } from "./pipeline-card";
import { useDeployPipeline } from "./use-deploy-pipeline";

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export function DeployScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const { statuses, running, start } = useDeployPipeline();

  return (
    <section
      aria-label="Деплой"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Rocket}
        title="Деплой"
        description="Сборка Docker-образа → реестр → ваш хост"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button type="button" size="sm" onClick={start} disabled={running}>
          {running ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Rocket className="size-4" aria-hidden="true" />
          )}
          {running ? "Собираем…" : "Собрать и развернуть"}
        </Button>
      </ModuleHeader>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto vf-scroll">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          <motion.div {...fade} transition={{ duration: 0.3 }}>
            <PipelineCard statuses={statuses} />
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.05 }}>
            <BuildLogCard statuses={statuses} />
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Server className="size-4" aria-hidden="true" />
                Хосты
              </h2>
              <HostsSection onDeploy={start} />
            </div>
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.15 }}>
            <DeployHistoryTable />
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.2 }}>
            <EnvVarsCard />
          </motion.div>

          <motion.div {...fade} transition={{ duration: 0.3, delay: 0.25 }}>
            <WipBanner
              title="Что дальше"
              description="Автодеплой из интерфейса подключается к Docker-хостам на следующем этапе"
              features={["Docker", "SSH", "systemd", "rollback"]}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
