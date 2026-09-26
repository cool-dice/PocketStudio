/**
 * Code-app Project.origin values. Studios are origin=workspace
 * and belong to list_workspaces / GET /api/workspaces.
 */

export const CODE_PROJECT_ORIGINS = ["template", "github", "zip"] as const;

export type CodeProjectOrigin = (typeof CODE_PROJECT_ORIGINS)[number];

export function isCodeProjectOrigin(value: string): value is CodeProjectOrigin {
  return (CODE_PROJECT_ORIGINS as readonly string[]).includes(value);
}
