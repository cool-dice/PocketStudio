"use client";

/**
 * Profile name dialog — PATCH /api/me after validation. Empty name is a
 * field error; success toast only after the API returns.
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
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user?.name ?? "");
      setFieldError(null);
    }
  }, [open, user?.name]);

  async function save() {
    const parsed = validateDisplayName(name);
    if (!parsed.ok) {
      setFieldError(parsed.error);
      return;
    }
    setSaving(true);
    setFieldError(null);
    try {
      const next = await api.updateMe({ name: parsed.name });
      applyUser(next);
      const result = profileSaveToast(true);
      toast.success(result.message);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : profileSaveToast(false).message;
      setFieldError(profileNameFieldError(false, message));
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{PROFILE_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{PROFILE_DIALOG_HINT}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
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
              disabled={saving}
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
              disabled={saving}
            >
              Отмена
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
