"use client";

import { SocketProvider } from "@/hooks/use-socket";
import { ThreadsProvider } from "@/hooks/use-threads";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app/app-shell";
import { UrlSync } from "@/components/app/url-sync";
import { OnboardingTour } from "@/components/app/onboarding-tour";

export function AuthenticatedApp({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <SocketProvider key={user.id}>
      <ThreadsProvider>
        <UrlSync initialWorkspaceId={workspaceId} />
        <OnboardingTour />
        <AppShell />
      </ThreadsProvider>
    </SocketProvider>
  );
}
