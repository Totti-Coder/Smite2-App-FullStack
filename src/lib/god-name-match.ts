'use client';

// Matching gods by the NAME the scoreboard prints, instead of perceptual-
// hashing their portrait. The portrait references (SmiteSource's 256x256
// t_GodPortrait_*.png) turned out to be the correct square face icons, so
// the reference data was never the problem - but a 64-bit dHash of detailed
// character art, cropped by hand to within a few pixels, competing against
// 87 other detailed character-art hashes, is just an inherently fragile
// signal. The god's name is right there as text, and Tesseract reads text
// reliably. This is the primary matcher now; the hash stays as a fallback.

const STORAGE_KEY = 'smite2-learned-god-names-v1';

/** Uppercase, strip accents/punctuation/spaces - so "Poseidón" and "POSEIDON" collapse to the same key. */
export function normalizeGodName(raw: string): string {
  // NFD splits "Ó" into "O" + a combining accent, and the [^A-Z] filter then
  // drops the accent (along with spaces, hyphens and any OCR punctuation
  // noise) - so no separate accent-stripping pass is needed.
  return raw.normalize('NFD').toUpperCase().replace(/[^A-Z]/g, '');
}

// Spanish client localizations that normalization alone can't bridge (the
// name is genuinely a different word, not just an accented spelling).
// Anything NOT here still works via the edit-distance pass below, and
// anything that fails BOTH gets learned the first time you correct it in
// the review step (see rememberGodName) - so this list never has to be
// exhaustive or perfectly correct.
const NAME_ALIASES: Record<string, string> = {
  JANO: 'janus',
  QUIRON: 'chiron',
  AQUILES: 'achilles',
  ATENEA: 'athena',
  AFRODITA: 'aphrodite',
  APOLO: 'apollo',
  BACO: 'bacchus',
  CARONTE: 'charon',
  CERBERO: 'cerberus',
  CRONOS: 'chronos',
  ESCILA: 'scylla',
  MERCURIO: 'mercury',
  VULCANO: 'vulcan',
  SILVANO: 'sylvanus',
  ALADINO: 'aladdin',
  LAMORRIGAN: 'the_morrigan',
};

type LearnedNames = Record<string, string>; // normalized OCR text -> god id

export function loadLearnedGodNames(): LearnedNames {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LearnedNames) : {};
  } catch {
    return {};
  }
}

/** Records "this OCR'd text means this god" after a user confirms/corrects a row. */
export function rememberGodName(rawText: string, godId: string) {
  if (typeof window === 'undefined') return;
  const key = normalizeGodName(rawText);
  if (key.length < 3) return; // too short to be a trustworthy key
  const table = loadLearnedGodNames();
  table[key] = godId;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
}

export function clearLearnedGodNames() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function learnedGodNameCount(): number {
  return Object.keys(loadLearnedGodNames()).length;
}

/** Standard Levenshtein, iterative single-row - these strings are short (<20 chars). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

export type GodNameMatch = { id: string; distance: number; source: 'learned' | 'alias' | 'exact' | 'fuzzy' };

/**
 * Resolves OCR'd scoreboard text to a god id. Tries, in order: what the
 * user has already taught it, the Spanish alias table, an exact normalized
 * match, then closest-by-edit-distance. Returns null only when nothing is
 * close enough to be worth guessing.
 */
export function matchGodByName(
  rawText: string,
  gods: { id: string; name: string }[]
): GodNameMatch | null {
  const key = normalizeGodName(rawText);
  if (key.length < 3) return null;

  const learned = loadLearnedGodNames()[key];
  if (learned) return { id: learned, distance: 0, source: 'learned' };

  const alias = NAME_ALIASES[key];
  if (alias && gods.some((g) => g.id === alias)) return { id: alias, distance: 0, source: 'alias' };

  let best: { id: string; distance: number } | null = null;
  for (const god of gods) {
    const candidate = normalizeGodName(god.name);
    if (candidate === key) return { id: god.id, distance: 0, source: 'exact' };
    const d = editDistance(key, candidate);
    if (!best || d < best.distance) best = { id: god.id, distance: d };
  }
  if (!best) return null;

  // Tolerance scales with name length: "RA" can't afford a typo, "CU
  // CHULAINN" can afford a few. Beyond this the guess is worse than
  // admitting we don't know, since the review UI makes "(sin detectar)"
  // cheap to fix but a confident wrong answer easy to miss.
  const maxDistance = Math.min(4, Math.max(1, Math.floor(key.length * 0.35)));
  return best.distance <= maxDistance ? { ...best, source: 'fuzzy' } : null;
}
