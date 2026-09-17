"use client";

/**
 * LandingScreen (guest) — hero, feature cards, how-it-works, CTA, sticky footer.
 * AuthCard opens in a Dialog from CTA buttons, or as a standalone view.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  Check,
  MessageSquareText,
  Moon,
  NotebookPen,
  Rocket,
  Sparkles,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import { AuthCard } from "@/components/auth/auth-card";
import { Logo, LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type AuthTab = "login" | "register";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export function LandingScreen() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("register");
  const [standaloneAuth, setStandaloneAuth] = useState(false);

  const openAuth = (tab: AuthTab) => {
    setAuthTab(tab);
    setAuthOpen(true);
  };

  if (standaloneAuth) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <Card className="rounded-xl border shadow-none">
            <CardContent className="flex flex-col items-center p-6 sm:p-8">
              <Logo className="mb-6" />
              <AuthCard defaultTab={authTab} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-6 text-muted-foreground"
                onClick={() => setStandaloneAuth(false)}
              >
                ← Назад на главную
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ThemeToggleGhost className="fixed top-4 right-4 z-10" />

      {/* ── Header ── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setAuthTab("login");
              setStandaloneAuth(true);
            }}
          >
            Войти
          </Button>
          <Button onClick={() => openAuth("register")}>
            Начать
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ── */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-start gap-5"
          >
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              Ранний доступ
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Мысли становятся{" "}
              <span className="text-primary">приложениями</span>
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground text-pretty">
              VibeFlow — ИИ-рабочее место, где один диалог превращает сырую
              идею в заметку, план и работающий MVP. Не переключайтесь между
              инструментами — просто говорите.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => openAuth("register")}>
                Начать бесплатно
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Как это работает
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Без карты. Первый аккаунт получает права администратора.
            </p>
          </motion.div>

          <HeroMockChat />
        </section>

        {/* ── Features ── */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="mb-10 max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Один интерфейс — весь поток
              </h2>
              <p className="mt-2 text-muted-foreground">
                Чат здесь не вложение, а главный пульт: агент понимает
                намерения и сам распоряжается заметками и проектами.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={<MessageSquareText className="size-5" aria-hidden="true" />}
                title="Диалог — центр управления"
                description="Общайтесь как с живым ассистентом: он контекстно отвечает, уточняет и действует."
              />
              <FeatureCard
                icon={<NotebookPen className="size-5" aria-hidden="true" />}
                title="Блокнот из мыслей"
                description="Сказали — записалось. Мысли превращаются в структурированные заметки с категориями."
              />
              <FeatureCard
                icon={<Rocket className="size-5" aria-hidden="true" />}
                title="От идеи до MVP"
                description="План, код и результат — в одном окне. Экспортируйте, когда будете готовы."
              />
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <h2 className="mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">
              Как это работает
            </h2>
            <ol className="grid gap-6 sm:grid-cols-3">
              <StepCard
                step="1"
                title="Опишите мысль"
                description="Пара предложений голосом или текстом — как есть, без структуры."
              />
              <StepCard
                step="2"
                title="Агент раскладывает по полочкам"
                description="Заметка, план или проект создаются сами — вы подтверждаете и правите."
              />
              <StepCard
                step="3"
                title="Соберите MVP"
                description="Задача превращается в работающий прототип, готовый к показу."
              />
            </ol>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t bg-secondary/40">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:py-20">
            <LogoMark className="size-12 rounded-xl" />
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Готовы проверить, куда приведёт первая мысль?
            </h2>
            <Button size="lg" onClick={() => openAuth("register")}>
              Создать аккаунт
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </section>
      </main>

      {/* ── Footer (sticky) ── */}
      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2025 VibeFlow</span>
          <span>мысли → заметки → приложения</span>
        </div>
      </footer>

      {/* ── Auth dialog ── */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Вход или регистрация</DialogTitle>
          <DialogDescription className="sr-only">
            Войдите или создайте аккаунт VibeFlow
          </DialogDescription>
          <AuthCard defaultTab={authTab} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Pieces ── */

function ThemeToggleGhost({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Переключить тему"
      className={className}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}

function HeroMockChat() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-md"
      aria-hidden="true"
    >
      {/* soft emerald glow behind the card */}
      <div
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/5 blur-2xl"
        aria-hidden="true"
      />
      <div className="rounded-2xl border bg-card p-4 shadow-lg sm:p-5">
        <div className="mb-4 flex items-center gap-2 border-b pb-3">
          <LogoMark className="size-6 rounded-md" />
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-secondary" />
            <span className="size-2.5 rounded-full bg-secondary" />
            <span className="size-2.5 rounded-full bg-secondary" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              Хочу трекер привычек, но лень настраивать…
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </span>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md border bg-background px-3.5 py-2 text-sm">
              Записал мысль в «Блокнот» и набросал план MVP. Начнём с экрана
              привычек?
            </div>
          </div>
          <div className="flex items-center gap-2 pl-8 text-muted-foreground">
            <span className="vf-dot" />
            <span className="vf-dot" />
            <span className="vf-dot" />
          </div>
          {/* mock composer mirrors the real product (with / hint) */}
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span className="flex-1 truncate">
              Напишите сообщение… или / для команд
            </span>
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ArrowUp className="size-3" />
            </span>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute -top-3 -right-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md sm:-right-4"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Check className="size-3.5 text-primary" aria-hidden="true" />
        Заметка создана
      </motion.div>
      <motion.div
        className="absolute -bottom-3 -left-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md sm:-left-4"
        animate={{ y: [0, 4, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8,
        }}
      >
        <Rocket className="size-3.5 text-primary" aria-hidden="true" />
        План MVP готов
      </motion.div>
    </motion.div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-xl border bg-card shadow-none transition-colors duration-200 hover:border-primary/40">
      <CardContent className="flex flex-col gap-3 p-6">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold leading-snug">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {step}
      </span>
      <h3 className="font-semibold leading-snug">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </li>
  );
}
