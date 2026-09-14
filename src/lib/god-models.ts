/**
 * Gods that ship a 3D model, by id.
 *
 * Kept as an explicit map rather than a path convention on purpose: these
 * files are ENORMOUS (Ix Chel's is 9 MB, roughly 40x the whole JS bundle for
 * a page), so a god without an entry here must render exactly as before and
 * download nothing. Adding a god is one line; forgetting to add one costs
 * nothing.
 */
export const GOD_MODELS: Record<string, string> = {
  ix_chel: '/assets/smite_-_ix_chel.glb',
};

export function godModelPath(godId: string): string | null {
  return GOD_MODELS[godId] ?? null;
}
