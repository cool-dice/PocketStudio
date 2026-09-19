"use client";

/**
 * Profile dialog — PATCH /api/me (name) and PATCH /api/me/password.
 * Empty name is a field error; password needs the current secret.
 * Success toasts only after the API returns, and never print the password.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import {
  PASSWORD_CHANGE_FAILED,
  PASSWORD_CONFIRM_LABEL,
  PASSWORD_CURRENT_LABEL,
  PASSWORD_NEW_LABEL,
  PASSWORD_SECTION_HINT,
  PASSWORD_SECTION_TITLE,
  PASSWORD_SUBMIT,
  PASSWORD_SUBMITTING,
  passwordChangeToast,
  validatePasswordChange,
} from "@/lib/password-copy";
import {
  DISPLAY_NAME_MAX,
  PROFILE_DIALOG_HINT,
  PROFILE_DIALOG_TITLE,
  PROFILE_NAME_LABEL,
  profileNameFieldError,
  profileSaveToast,
  validateDisplayName,
} from "@/lib/profile-copy";

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, applyUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFields, setPasswordFields] = useState<Record<string, string>>(
    {},
  );
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const busy = savingName || savingPassword;

  useEffect(() => {
    if (open) {
      setName(user?.name ?? "");
      setFieldError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFields({});
      setPasswordError(null);
    }
  }, [open, user?.name]);

  async function saveName() {
    const parsed = validateDisplayName(name);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    setSavingName(true);
    setFieldError(null);
    try {
      const next = await api.updateMe({ name: parsed.name });
      applyUser(next);
      const result = profileSaveToast(true);
      toast.success(result.message);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : profileSaveToast(false).message;
      setFieldError(profileNameFieldError(false, message));
      toast.error(message);
    } finally {
      setSavingName(false);
    }
  }

  function clearPasswordErrors() {
    setPasswordFields({});
    setPasswordError(null);
  }

  async function savePassword() {
    const parsed = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.ok) {
      setPasswordFields(parsed.fields);
      setPasswordError(parsed.error);
      return;
    }
    setSavingPassword(true);
    clearPasswordErrors();
    try {
      const next = await api.changePassword({
        currentPassword: parsed.currentPassword,
        newPassword: parsed.newPassword,
        confirmPassword: parsed.newPassword,
      });
      applyUser(next);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(passwordChangeToast(true).message);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      const message = apiErr?.message ?? PASSWORD_CHANGE_FAILED;
      setPasswordFields(apiErr?.fields ?? {});
      setPasswordError(message);
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{PROFILE_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{PROFILE_DIALOG_HINT}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">{PROFILE_NAME_LABEL}</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldError(null);
              }}
              maxLength={DISPLAY_NAME_MAX}
              autoComplete="nickname"
              aria-invalid={!!fieldError}
              disabled={busy}
            />
            {fieldError ? (
              <p className="text-xs text-destructive" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Закрыть
            </Button>
            <Button type="submit" disabled={busy} aria-busy={savingName}>
              {savingName ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>

        <Separator />

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void savePassword();
          }}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium">{PASSWORD_SECTION_TITLE}</p>
            <p className="text-xs text-muted-foreground">{PASSWORD_SECTION_HINT}</p>
          </div>
          <PasswordField
            id="profile-current-password"
            label={PASSWORD_CURRENT_LABEL}
            autoComplete="current-password"
            value={currentPassword}
            error={passwordFields.currentPassword}
            disabled={busy}
            onChange={(value) => {
              setCurrentPassword(value);
              clearPasswordErrors();
            }}
          />
          <PasswordField
            id="profile-new-password"
            label={PASSWORD_NEW_LABEL}
            autoComplete="new-password"
            value={newPassword}
            error={passwordFields.newPassword}
            disabled={busy}
            placeholder="Минимум 8 символов"
            onChange={(value) => {
              setNewPassword(value);
              clearPasswordErrors();
            }}
          />
          <PasswordField
            id="profile-confirm-password"
            label={PASSWORD_CONFIRM_LABEL}
            autoComplete="new-password"
            value={confirmPassword}
            error={passwordFields.confirmPassword}
            disabled={busy}
            onChange={(value) => {
              setConfirmPassword(value);
              clearPasswordErrors();
            }}
          />
          {passwordError &&
          !passwordFields.currentPassword &&
          !passwordFields.newPassword &&
          !passwordFields.confirmPassword ? (
            <p className="text-xs text-destructive" role="alert">
              {passwordError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={busy} aria-busy={savingPassword}>
              {savingPassword ? PASSWORD_SUBMITTING : PASSWORD_SUBMIT}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  id,
  label,
  value,
  error,
  disabled,
  autoComplete,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  autoComplete: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder ?? "••••••••"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
