"use client";

/**
 * AuthCard — tabs «Вход» / «Регистрация».
 * Used on `/login` (landing CTAs go there instead of an inline dialog).
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
} from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";

import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  inviteRegisterCopy,
  inviteRoleLabel,
  type InviteLifecycle,
} from "@/lib/invite-status";
import { firstUserAdminHint } from "@/lib/landing-copy";

type AuthTab = "login" | "register";

interface AuthCardProps {
  defaultTab?: AuthTab;
  className?: string;
  inviteToken?: string;
}

export function AuthCard({
  defaultTab = "login",
  className,
  inviteToken,
}: AuthCardProps) {
  const { login, register } = useAuth();

  const [tab, setTab] = useState<AuthTab>(
    inviteToken ? "register" : defaultTab,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<InviteLifecycle | null>(
    inviteToken ? null : "invalid",
  );
  const [inviteRole, setInviteRole] = useState<"admin" | "client" | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setInviteStatus("invalid");
      return;
    }
    let cancelled = false;
    void api
      .peekInvite(inviteToken)
      .then((peek) => {
        if (cancelled) return;
        setInviteStatus(peek.status);
        if (peek.role) setInviteRole(peek.role);
        if (peek.email && peek.status === "ok") {
          setEmail((current) => current || peek.email || "");
        }
      })
      .catch(() => {
        if (!cancelled) setInviteStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const resetErrors = () => {
    setError(null);
    setFieldErrors({});
  };

  const switchTab = (value: string) => {
    setTab(value as AuthTab);
    resetErrors();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Light client-side validation; the server re-validates everything.
    if (tab === "register" && trimmedName.length < 2) {
      setFieldErrors({ name: "Имя должно содержать минимум 2 символа" });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setFieldErrors({ email: "Некорректный email" });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: "Пароль должен содержать минимум 8 символов" });
      return;
    }
    if (
      tab === "register" &&
      inviteToken &&
      inviteStatus &&
      inviteStatus !== "ok"
    ) {
      setError(inviteRegisterCopy(inviteStatus));
      return;
    }

    setLoading(true);
    try {
      if (tab === "login") {
        await login(trimmedEmail, password);
      } else {
        await register(trimmedName, trimmedEmail, password, inviteToken);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      } else {
        setError("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-sm", className)}>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {tab === "login" ? "С возвращением" : "Создайте аккаунт"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "login"
            ? "Войдите, чтобы продолжить работу"
            : inviteToken
              ? inviteStatus && inviteStatus !== "ok"
                ? inviteRegisterCopy(inviteStatus)
                : inviteRole
                  ? `Вас пригласили как ${inviteRoleLabel(inviteRole)}. Email должен совпадать с приглашением.`
                  : inviteRegisterCopy("ok")
              : ["Пара шагов — и мысли потекут.", firstUserAdminHint()]
                  .filter(Boolean)
                  .join(" ")}
        </p>
      </div>

      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList className="mb-4 grid w-full grid-cols-2">
          <TabsTrigger value="login">Вход</TabsTrigger>
          <TabsTrigger value="register">Регистрация</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FieldRow
              id="login-email"
              label="Email"
              error={fieldErrors.email}
            >
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.email}
                disabled={loading}
                required
              />
            </FieldRow>
            <FieldRow
              id="login-password"
              label="Пароль"
              error={fieldErrors.password}
            >
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                disabled={loading}
                required
              />
            </FieldRow>

            {error && <ErrorBanner message={error} />}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="size-4" aria-hidden="true" />
              )}
              {loading ? "Входим…" : "Войти"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FieldRow
              id="register-name"
              label="Имя"
              error={fieldErrors.name}
            >
              <Input
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Как к вам обращаться"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!fieldErrors.name}
                disabled={loading}
                required
                maxLength={60}
              />
            </FieldRow>
            <FieldRow
              id="register-email"
              label="Email"
              error={fieldErrors.email}
            >
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldErrors.email}
                disabled={loading}
                required
              />
            </FieldRow>
            <FieldRow
              id="register-password"
              label="Пароль"
              error={fieldErrors.password}
            >
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
                disabled={loading}
                required
                minLength={8}
              />
            </FieldRow>

            {error && <ErrorBanner message={error} />}

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                Boolean(inviteToken && inviteStatus && inviteStatus !== "ok")
              }
              aria-busy={loading}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              {loading ? "Создаём…" : "Создать аккаунт"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Регистрируясь, вы соглашаетесь хранить свои мысли в порядке.
      </p>
    </div>
  );
}

function FieldRow({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const control =
    isValidElement(children)
      ? cloneElement(children as ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>, {
          "aria-describedby": error ? errorId : undefined,
          "aria-invalid": !!error,
        })
      : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
    >
      {message}
    </p>
  );
}
