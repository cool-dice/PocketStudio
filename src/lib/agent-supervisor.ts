/**
 * Locate mini-services/agent-service/start.sh from the Next process cwd
 * (repo root in `next dev`, `.next/standalone` after `next start`).
 */

import { existsSync } from "node:fs";
import path from "node:path";

const RELATIVE_SUPERVISOR = path.join(
  "mini-services",
  "agent-service",
  "start.sh",
);

export function resolveAgentSupervisorPath(
  cwd: string = process.cwd(),
  exists: (filePath: string) => boolean = existsSync,
): string | null {
  let dir = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, RELATIVE_SUPERVISOR);
    if (exists(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
