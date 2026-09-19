"use client";

/**
 * Public GET /api/auth/bootstrap — first-user-admin copy only when the
 * next open registration would actually become admin. False until loaded
 * so we never flash the sentence on a studio that already has users.
 */

import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export function useFirstUserBecomesAdmin(): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .authBootstrap()
      .then((r) => {
        if (!cancelled) setFlag(Boolean(r.firstUserBecomesAdmin));
      })
      .catch(() => {
        if (!cancelled) setFlag(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return flag;
}
