/**
 * Empty DAW row for a new music workspace: schema defaults, no seed mix.
 * GET /daw still lazy-creates the same empty state if the row is missing.
 */

import type { PrismaClient } from "@prisma/client";

import type { DawState } from "./daw-model";

export function emptyDawState(bars = 4): DawState {
  return {
    bpm: 112,
    bars,
    masterVolume: 0.85,
    transpose: 0,
    metronome: false,
    tracks: [],
  };
}

export function dawCreateData(projectId: string, state: DawState = emptyDawState()) {
  return {
    projectId,
    bpm: state.bpm,
    bars: state.bars,
    masterVolume: state.masterVolume,
    transpose: state.transpose,
    metronome: state.metronome,
    tracks: JSON.stringify(state.tracks),
  };
}

export async function ensureEmptyDawProject(
  db: PrismaClient,
  projectId: string,
): Promise<{ id: string; tracks: string }> {
  const existing = await db.dawProject.findUnique({
    where: { projectId },
    select: { id: true, tracks: true },
  });
  if (existing) return existing;
  return db.dawProject.create({
    data: dawCreateData(projectId),
    select: { id: true, tracks: true },
  });
}
