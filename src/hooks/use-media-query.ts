"use client";

/**
 * useMediaQuery — SSR-safe media query subscription.
 * Returns false until the effect runs on the client (first paint),
 * then tracks the query live.
 */

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Below the xl breakpoint (context panel is an aside at xl+, dialog below). */
export function useIsNarrow(): boolean {
  return useMediaQuery("(max-width: 1279px)");
}
