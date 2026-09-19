"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { motion } from "framer-motion";

import { AuthCard } from "@/components/auth/auth-card";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LogoMark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthenticatedApp } from "@/components/app/authenticated-app";
import { safeNextPath } from "@/lib/safe-next";

function LoginInner() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/";
  const invite = params.get("invite") || undefined;
  const tab = params.get("tab") === "register" ? "register" : "login";
  const safeNext = safeNextPath(next);

  useEffect(() => {
    if (user) {
      router.replace(safeNext);
    }
  }, [user, safeNext, router]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Загрузка входа"
      >
        <LogoMark className="size-12 animate-pulse rounded-xl" />
        <span className="sr-only">Загрузка PocketStudio…</span>
      </div>
    );
  }

  if (user) {
    return (
      <Suspense fallback={<Skeleton className="h-dvh w-full" />}>
        <AuthenticatedApp />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-xl border shadow-none">
          <CardContent className="flex flex-col items-center p-6 sm:p-8">
            <Logo className="mb-6" />
            <AuthCard defaultTab={tab} inviteToken={invite} />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-dvh items-center justify-center"
          role="status"
          aria-live="polite"
          aria-label="Загрузка входа"
        >
          <LogoMark className="size-12 animate-pulse rounded-xl" />
          <span className="sr-only">Загрузка PocketStudio…</span>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
