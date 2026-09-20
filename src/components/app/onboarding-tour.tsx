"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useAppUi } from "@/lib/store";
import {
  onboardingBlocksTour,
  readOnboardingDone,
  shouldOpenOnboarding,
  writeOnboardingDone,
} from "@/lib/onboarding-gate";

const STEPS = [
  {
    title: "Чат — главный инструмент",
    body: "Опишите задачу оркестратору: он создаст заметку, главу, картинку или трек в открытом воркспейсе.",
  },
  {
    title: "Воркспейс — один замысел",
    body: "Книга, фильм, музыка или приложение живут в одном контексте. Ссылка /w/… открывает его снова.",
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

export function OnboardingTour() {
  const { user, markOnboardingDone } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const finishing = useRef(false);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const createWorkspaceOpen = useAppUi((s) => s.createWorkspaceOpen);
  const createProjectOpen = useAppUi((s) => s.createProjectOpen);
  const captureOpen = useAppUi((s) => s.captureOpen);
  const mainArea = useAppUi((s) => s.mainArea);
  const blocksTour = onboardingBlocksTour({
    createWorkspaceOpen,
    createProjectOpen,
    captureOpen,
    mainArea,
  });

  useEffect(() => {
    if (!user) return;
    const localDone = readOnboardingDone(user.id);
    if (
      !shouldOpenOnboarding({
        userId: user.id,
        userDone: Boolean(user.onboardingDone),
        localDone,
        finishing: finishing.current,
        blocksTour,
      })
    ) {
      if (blocksTour || localDone || user.onboardingDone || finishing.current) {
        setOpen(false);
      }
      return;
    }
    let cancelled = false;
    api
      .getOnboarding()
      .then((r) => {
        if (cancelled || finishing.current) return;
        const ui = useAppUi.getState();
        if (
          shouldOpenOnboarding({
            userId: user.id,
            userDone: r.onboardingDone || Boolean(user.onboardingDone),
            localDone: readOnboardingDone(user.id),
            finishing: finishing.current,
            blocksTour: onboardingBlocksTour(ui),
          })
        ) {
          setOpen(true);
        }
      })
      .catch(() => {
        if (cancelled || finishing.current) return;
        const ui = useAppUi.getState();
        if (
          shouldOpenOnboarding({
            userId: user.id,
            userDone: Boolean(user.onboardingDone),
            localDone: readOnboardingDone(user.id),
            finishing: finishing.current,
            blocksTour: onboardingBlocksTour(ui),
          })
        ) {
          setOpen(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, blocksTour]);

  async function finish(andQuest: boolean) {
    if (!user) return;
    finishing.current = true;
    setOpen(false);
    writeOnboardingDone(user.id);
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

  if (!open || blocksTour) return null;
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="onboarding-title"
        className="pointer-events-auto w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl"
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
