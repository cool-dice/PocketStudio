"use client";

/**
 * LandingScreen (guest) — marketing face of PocketStudio.
 * Assembles: hero → pipeline → modules → chat-first → how it works → CTA.
 * Auth CTAs go to `/login` (and `/login?tab=register`), not an inline dialog.
 */

import { useEffect, useState } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

import {
  cycleThemePref,
  parseThemePref,
  themeToggleAriaLabel,
} from "@/lib/theme-pref";

import { ChatFeatureSection } from "@/components/landing/chat-feature-section";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ModulesSection } from "@/components/landing/modules-section";
import { PipelineSection } from "@/components/landing/pipeline-section";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useFirstUserBecomesAdmin } from "@/hooks/use-auth-bootstrap";
import { landingCtaHref } from "@/lib/landing-copy";

export function LandingScreen() {
  const firstUserBecomesAdmin = useFirstUserBecomesAdmin();

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-background">
      <ThemeToggleGhost className="fixed top-4 right-4 z-10" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href={landingCtaHref("login")}>Войти</Link>
          </Button>
          <Button asChild>
            <Link href={landingCtaHref("register")}>
              Начать
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <HeroSection firstUserBecomesAdmin={firstUserBecomesAdmin} />
        <PipelineSection />
        <ModulesSection />
        <ChatFeatureSection />
        <HowItWorksSection firstUserBecomesAdmin={firstUserBecomesAdmin} />
      </main>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <span>© 2026 PocketStudio</span>
          <span>замысел → фильм → выпуск</span>
        </div>
      </footer>
    </div>
  );
}

function ThemeToggleGhost({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pref = mounted ? parseThemePref(theme) : "system";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={themeToggleAriaLabel(pref)}
      className={className}
      onClick={() => setTheme(cycleThemePref(pref))}
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
