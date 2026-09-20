"use client";

import { useEffect } from "react";

import { RouteErrorView } from "@/components/app/route-error-view";
import { logRouteError, routeErrorViewModel } from "@/lib/route-error-copy";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logRouteError(error);
  }, [error]);

  return (
    <RouteErrorView model={routeErrorViewModel("error")} onRetry={reset} />
  );
}
