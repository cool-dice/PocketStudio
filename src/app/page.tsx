"use client";

import { Suspense } from "react";

import { AuthenticatedApp } from "@/components/app/authenticated-app";
import { LandingScreen } from "@/components/landing/landing-screen";
import { LogoMark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

function RootScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <BootSkeleton />;
  }

  if (!user) {
    return <LandingScreen />;
  }

  return (
    <Suspense fallback={<BootSkeleton />}>
      <AuthenticatedApp />
    </Suspense>
  );
}

function BootSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      <LogoMark className="size-12 animate-pulse rounded-xl" />
      <div className="w-full max-w-xs space-y-2">
        <Skeleton className="h-3 w-3/4 mx-auto rounded-full" />
        <Skeleton className="h-3 w-1/2 mx-auto rounded-full" />
      </div>
      <span className="sr-only" role="status">
        Загрузка PocketStudio…
      </span>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<BootSkeleton />}>
      <RootScreen />
    </Suspense>
  );
}
