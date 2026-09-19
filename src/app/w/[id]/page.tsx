"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AuthenticatedApp } from "@/components/app/authenticated-app";
import { LogoMark } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";

function WorkspaceInner() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  useEffect(() => {
    if (!loading && !user && id) {
      const qs = searchParams.toString();
      const target = qs ? `/w/${id}?${qs}` : `/w/${id}`;
      router.replace(`/login?next=${encodeURIComponent(target)}`);
    }
  }, [loading, user, id, router, searchParams]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <LogoMark className="size-12 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <AuthenticatedApp workspaceId={id} />
    </Suspense>
  );
}

export default function WorkspacePage() {
  return <WorkspaceInner />;
}
