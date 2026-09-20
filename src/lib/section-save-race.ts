/**
 * Autosave race: an older PATCH must not clobber a newer local revision.
 */

export function nextSaveSeq(
  map: Map<string, number>,
  sectionId: string,
): number {
  const seq = (map.get(sectionId) ?? 0) + 1;
  map.set(sectionId, seq);
  return seq;
}

export function isStaleSectionSave(
  map: Map<string, number>,
  sectionId: string,
  requestSeq: number,
): boolean {
  return (map.get(sectionId) ?? 0) !== requestSeq;
}
