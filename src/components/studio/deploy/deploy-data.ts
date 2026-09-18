/**
 * Deploy module — mock data (pure visual, no fetch).
 * Palette: stone + emerald (amber only for "в процессе", red only for errors).
 */

import type { LucideIcon } from "lucide-react";
import { Container, FlaskConical, Package, Server } from "lucide-react";

/* ── Pipeline ─────────────────────────────────────────────────── */

export type StepStatus = "idle" | "running" | "done";

export interface PipelineStep {
  id: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  chip: string;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "build",
    icon: Container,
    title: "Сборка образа",
    sub: "node:20-alpine",
    chip: "Dockerfile",
  },
  {
    id: "test",
    icon: FlaskConical,
    title: "Тесты",
    sub: "12 тестов · 38 сек",
    chip: "vitest",
  },
  {
    id: "registry",
    icon: Package,
    title: "Реестр",
    sub: "registry.pocketstudio.io",
    chip: "app:1.4.2",
  },
  {
    id: "host",
    icon: Server,
    title: "Хост",
    sub: "46.17.xx.xx",
    chip: "docker compose",
  },
];

/* ── Build log ─────────────────────────────────────────────────── */

export interface LogLine {
  kind: "cmd" | "ok" | "info";
  text: string;
}

export const LOG_IDLE_HINT: LogLine = {
  kind: "info",
  text: "# журнал пуст — нажмите «Собрать и развернуть»",
};

export const LOG_CMD_BUILD: LogLine = {
  kind: "cmd",
  text: "→ docker build -t pocketstudio/app:1.4.2 .",
};

export const LOG_BUILD_STEPS: LogLine[] = [
  { kind: "ok", text: "✔ шаг 1/14 : FROM node:20-alpine" },
  { kind: "ok", text: "✔ шаг 14/14 : CMD [\"bun\",\"start\"]" },
];

export const LOG_TESTS_DONE: LogLine = {
  kind: "ok",
  text: "✔ тесты пройдены: 12/12 за 38 сек",
};

export const LOG_CMD_PUSH: LogLine = {
  kind: "cmd",
  text: "→ push registry.pocketstudio.io/pocketstudio/app:1.4.2",
};

export const LOG_CMD_SSH: LogLine = {
  kind: "cmd",
  text: "→ ssh deploy@46.17.xx.xx 'docker compose pull && up -d'",
};

export const LOG_DONE: LogLine = {
  kind: "ok",
  text: "✔ Деплой завершён за 2 мин 41 сек",
};

/* ── Hosts ─────────────────────────────────────────────────────── */

export interface DeployHost {
  id: string;
  name: string;
  address: string;
  app: string;
  version: string;
  lastDeploy: string;
  connected: boolean;
}

export const HOSTS: DeployHost[] = [
  {
    id: "production",
    name: "production",
    address: "46.17.250.88",
    app: "pocketstudio/app",
    version: "v1.4.2",
    lastDeploy: "2 дня назад",
    connected: true,
  },
  {
    id: "staging",
    name: "staging",
    address: "46.17.250.89",
    app: "pocketstudio/app",
    version: "v1.5.0-rc.1",
    lastDeploy: "5 часов назад",
    connected: true,
  },
  {
    id: "vps-friend",
    name: "vps-friend",
    address: "91.219.42.17",
    app: "pocketstudio/app",
    version: "v1.3.2",
    lastDeploy: "3 недели назад",
    connected: false,
  },
];

/* ── Deploy history ────────────────────────────────────────────── */

export type DeployEnv = "prod" | "stage";
export type DeployResult = "success" | "rollback" | "failed";

export interface DeployRecord {
  id: string;
  version: string;
  host: string;
  env: DeployEnv;
  result: DeployResult;
  time: string;
  commit: string;
  message: string;
}

export const DEPLOY_HISTORY: DeployRecord[] = [
  {
    id: "d1",
    version: "v1.4.2",
    host: "production",
    env: "prod",
    result: "success",
    time: "сегодня, 14:02",
    commit: "9f3ac21",
    message: "правка мобильной навигации",
  },
  {
    id: "d2",
    version: "v1.5.0-rc.1",
    host: "staging",
    env: "stage",
    result: "success",
    time: "сегодня, 11:40",
    commit: "c8e0d47",
    message: "витрина лендинга и тарифов",
  },
  {
    id: "d3",
    version: "v1.4.1",
    host: "production",
    env: "prod",
    result: "rollback",
    time: "вчера, 19:26",
    commit: "4b1f9e2",
    message: "хотфикс оплаты — откат на v1.4.0",
  },
  {
    id: "d4",
    version: "v1.4.1",
    host: "production",
    env: "prod",
    result: "success",
    time: "вчера, 18:55",
    commit: "4b1f9e2",
    message: "хотфикс оплаты",
  },
  {
    id: "d5",
    version: "v1.4.0",
    host: "production",
    env: "prod",
    result: "failed",
    time: "3 дня назад",
    commit: "77ad90c",
    message: "релиз редактора глав",
  },
  {
    id: "d6",
    version: "v1.4.0",
    host: "staging",
    env: "stage",
    result: "success",
    time: "3 дня назад",
    commit: "77ad90c",
    message: "релиз редактора глав",
  },
  {
    id: "d7",
    version: "v1.3.2",
    host: "vps-friend",
    env: "prod",
    result: "success",
    time: "3 недели назад",
    commit: "0e51b8f",
    message: "первый деплой на VPS друга",
  },
];

/* ── Env vars ──────────────────────────────────────────────────── */

export interface EnvVar {
  key: string;
  value: string;
}

export const ENV_VARS: EnvVar[] = [
  { key: "DATABASE_URL", value: "postgres://studio:••••@db:5432/prod" },
  { key: "AUTH_SECRET", value: "kX81mf9Lq2ZtR4wPe7Sd" },
  { key: "STRIPE_API_KEY", value: "sk_live_51Kx2••••••••" },
  { key: "OPENAI_API_KEY", value: "sk-proj-7Qm••••••••" },
  { key: "SMTP_PASSWORD", value: "••••••••••••" },
  { key: "SENTRY_DSN", value: "https://o491••••.ingest.sentry.io" },
];

export const ENV_VARS_TOTAL = 12;
