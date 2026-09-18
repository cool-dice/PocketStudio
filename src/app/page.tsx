"use client";

/**
 * VibeFlow SPA root — single "/" route.
 * loading → skeleton · !user → LandingScreen · user → AppShell (chat-first).
 * SocketProvider / ThreadsProvider mount only for authenticated users, so
 * logout naturally tears the socket and thread state down.
 */

import { AppShell } from "@/components/app/app-shell";
import { LandingScreen } from "@/components/landing/landing-screen";
import { LogoMark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SocketProvider } from "@/hooks/use-socket";
import { ThreadsProvider } from "@/hooks/use-threads";

function RootScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return <BootSkeleton />;
  }

  if (!user) {
    return <LandingScreen />;
  }

  return (
    <SocketProvider key={user.id}>
      <ThreadsProvider>
        <AppShell />
      </ThreadsProvider>
    </SocketProvider>
  );
}

/** Full-screen skeleton while /api/auth/me resolves (first paint). */
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
    <AuthProvider>
      <RootScreen />
    </AuthProvider>
  );
}
