import type { Metadata } from "next";
import type { ReactNode } from "react";

import { appRouteMetadata } from "@/lib/robots";

/** Private workspace shells — noindex even if a crawler ignores robots.txt. */
export const metadata: Metadata = appRouteMetadata();

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return children;
}
