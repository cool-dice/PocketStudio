/**
 * Shared typed-workspace create path: HTTP POST /api/workspaces and the
 * agent `create_workspace` tool must not diverge (origin, pipeline stage,
 * app scaffolding only for type=app).
 */

import type { PrismaClient } from "@prisma/client";

import { ensureEmptyDawProject } from "./daw-empty";
import { ensureCodeWorkspace } from "./workspace";
import {
  CREATE_WORKSPACE_DESC_LONG,
  CREATE_WORKSPACE_NAME_EMPTY,
  CREATE_WORKSPACE_NAME_LONG,
  CREATE_WORKSPACE_TYPE_BAD,
  parseWorkspaceKind,
  WORKSPACE_FIRST_STAGE,
  type WorkspaceKindName,
} from "./workspace-kind";

export interface WorkspaceCreateInput {
  name: unknown;
  type: unknown;
  description?: unknown;
}

export interface ValidWorkspaceCreate {
  name: string;
  type: WorkspaceKindName;
  description: string | null;
}

export function validateWorkspaceCreate(
  input: WorkspaceCreateInput,
): ValidWorkspaceCreate | { error: string } {
  const type = parseWorkspaceKind(input.type);
  if (!type) return { error: CREATE_WORKSPACE_TYPE_BAD };

  if (typeof input.name !== "string") {
    return { error: CREATE_WORKSPACE_NAME_EMPTY };
  }
  const name = input.name.trim();
  if (!name) return { error: CREATE_WORKSPACE_NAME_EMPTY };
  if (name.length > 80) return { error: CREATE_WORKSPACE_NAME_LONG };

  if (input.description === undefined || input.description === null) {
    return { name, type, description: null };
  }
  if (typeof input.description !== "string") {
    return { error: CREATE_WORKSPACE_DESC_LONG };
  }
  const description = input.description.trim();
  if (description.length > 500) return { error: CREATE_WORKSPACE_DESC_LONG };
  return { name, type, description: description || null };
}

export interface CreatedTypedWorkspace {
  id: string;
  name: string;
  description: string | null;
  origin: string;
  type: string;
  stage: string | null;
  stageIndex: number | null;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

async function scaffoldAppIfNeeded(
  db: PrismaClient,
  projectId: string,
  type: WorkspaceKindName,
): Promise<void> {
  if (type !== "app") return;
  try {
    const root = await ensureCodeWorkspace(projectId);
    await db.project.update({
      where: { id: projectId },
      data: { rootPath: root },
    });
  } catch (err) {
    console.error(
      "[workspaces] code scaffold failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function createTypedWorkspace(
  db: PrismaClient,
  userId: string,
  input: ValidWorkspaceCreate,
): Promise<CreatedTypedWorkspace> {
  const stage = WORKSPACE_FIRST_STAGE[input.type];
  const project = await db.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      origin: "workspace",
      type: input.type,
      stage,
      stageIndex: 1,
      progress: 0,
    },
  });
  await scaffoldAppIfNeeded(db, project.id, input.type);
  if (input.type === "music") {
    await ensureEmptyDawProject(db, project.id);
  }
  return project;
}
