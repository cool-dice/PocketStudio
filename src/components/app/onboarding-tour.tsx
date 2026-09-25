"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useAppUi } from "@/lib/store";

const STEPS = [
  {
    title: "Чат — главный инструмент",
    body: "Опишите задачу оркестратору: он создаст заметку, главу, картинку или трек в открытом воркспейсе.",
  },
  {
    title: "Воркспейс — один замысел",
    body: "Фильм, книга или музыка живут в одном контексте картины. Ссылка /w/… открывает его снова.",
  },
  {
    title: "Редакторы — докрутить руками",
    body: "Не то, что сгенерировал чат? Откройте Дизайн, DAW или Монтаж и поправьте артефакт.",
  },
  {
    title: "Скиллы и доход",
    body: "В Инструментах включайте SKILL.md для агента, собирайте офферы и следите за выплатами.",
  },
];

const ONBOARDING_DONE_KEY = "pocketstudio-onboarding-done";

function readLocalOnboardingDone(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocalOnboardingDone() {
  try {
    window.localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function OnboardingTour() {
  const { user, markOnboardingDone } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const finishing = useRef(false);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);

  useEffect(() => {
    if (!user || user.onboardingDone || readLocalOnboardingDone() || finishing.current) {
      return;
    }
    let cancelled = false;
    api
      .getOnboarding()
      .then((r) => {
        if (!cancelled && !r.onboardingDone && !readLocalOnboardingDone()) setOpen(true);
      })
      .catch(() => {
        if (!cancelled && !readLocalOnboardingDone() && !user.onboardingDone) setOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!open) return null;
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  async function finish(andQuest: boolean) {
    finishing.current = true;
    setOpen(false);
    writeLocalOnboardingDone();
    markOnboardingDone();
    try {
      await api.setOnboardingDone(true);
    } catch {
      // local flag already set — tour will not loop on reload
    }
    if (andQuest) {
      try {
        sessionStorage.setItem("pocketstudio-quest", "1");
      } catch {
        /* ignore */
      }
      setCaptureOpen(true);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Знакомство {step + 1} / {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mt-1 text-lg font-semibold">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {current.body}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => void finish(false)}>
            Пропустить
          </Button>
          {!last ? (
            <Button size="sm" className="ml-auto" onClick={() => setStep((s) => s + 1)}>
              Дальше
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  setMainArea("notebook");
                  void finish(true);
                }}
              >
                Quest: записать мысль
              </Button>
              <Button size="sm" onClick={() => void finish(false)}>
                В студию
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
