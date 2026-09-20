/**
 * Store-first URL sync: ignore the next URL→store apply after we pushed
 * a replace, so an in-flight router.replace cannot overwrite a newer tab.
 * Browser back/forward does not set the skip flag.
 */

export function createUrlSyncGuard() {
  let skipUrlApply = false;
  return {
    markStoreNav() {
      skipUrlApply = true;
    },
    consumeSkip() {
      if (!skipUrlApply) return false;
      skipUrlApply = false;
      return true;
    },
  };
}
