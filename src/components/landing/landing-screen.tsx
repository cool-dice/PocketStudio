"use client";

/**
 * LandingScreen (guest) — marketing face of PocketStudio.
 * Assembles: hero → pipeline → modules → chat-first → how it works → CTA.
 * AuthCard opens in a Dialog from CTA buttons, or as a standalone view.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ChatFeatureSection } from "@/components/landing/chat-feature-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ModulesSection } from "@/components/landing/modules-section";
import { PipelineSection } from "@/components/landing/pipeline-section";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type AuthTab = "login" | "register";

export function LandingScreen() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>("register");
  const [standaloneAuth, setStandaloneAuth] = useState(false);
  const router = useRouter();

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
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      <ThemeToggleGhost className="fixed top-4 right-4 z-10" />

      {/* ── Header ── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push("/login")}
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
        <HeroSection onRegister={() => openAuth("register")} />
        <PipelineSection />
        <ModulesSection />
        <ChatFeatureSection />
        <HowItWorksSection onRegister={() => openAuth("register")} />
      </main>

      {/* ── Footer (sticky) ── */}
      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 PocketStudio</span>
          <span>идея → продукт → доход</span>
        </div>
      </footer>

      {/* ── Auth dialog ── */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Вход или регистрация</DialogTitle>
          <DialogDescription className="sr-only">
            Войдите или создайте аккаунт PocketStudio
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
