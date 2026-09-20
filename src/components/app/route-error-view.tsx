"use client";

import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RouteErrorViewModel } from "@/lib/route-error-copy";

export function RouteErrorView({
  model,
  onRetry,
}: {
  model: RouteErrorViewModel;
  onRetry?: () => void;
}) {
  const showRetry = Boolean(onRetry && model.retryLabel);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-xl border shadow-none">
        <CardContent className="flex flex-col items-center p-6 text-center sm:p-8">
          <Logo className="mb-6" />
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {model.title}
          </h1>
          <p className="mt-2 text-pretty text-muted-foreground">{model.body}</p>
          <nav
            className="mt-6 flex flex-wrap items-center justify-center gap-3"
            aria-label="Дальше"
          >
            {showRetry ? (
              <Button type="button" onClick={onRetry}>
                {model.retryLabel}
              </Button>
            ) : null}
            <Button variant={showRetry ? "outline" : "default"} asChild>
              <Link href={model.homeHref}>{model.homeLabel}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={model.loginHref}>{model.loginLabel}</Link>
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
