"use client";

import { useEffect } from "react";

import { RouteErrorView } from "@/components/app/route-error-view";
import { logRouteError, routeErrorViewModel } from "@/lib/route-error-copy";

import "./globals.css";

export default function GlobalError({
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
    <html lang="ru">
      <body className="antialiased bg-background text-foreground">
        <RouteErrorView model={routeErrorViewModel("error")} onRetry={reset} />
      </body>
    </html>
  );
}
