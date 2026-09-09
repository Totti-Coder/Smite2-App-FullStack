// The precomputed reference hashes (icon-hashes.json) come from SmiteSource's
// big promotional portrait art (t_GodPortrait_*.png) - a visually different
// image than the small round icon Smite 2's own in-game scoreboard actually
// renders. No threshold tuning fixes matching against the wrong picture.
//
// This is the real fix: every time a user reviews a scan and confirms/
// corrects a god or role, that crop came straight from the real scoreboard
// UI - save its hash under the confirmed id. Future scans check these
// learned, game-accurate hashes FIRST (tight threshold, they should be
// near-identical crops of the same UI) before ever falling back to the
// mismatched reference set. A handful of reviewed matches builds up an
// accurate catalog with zero extra effort from the user beyond the review
// step they already have to do.
'use client';

import { hammingDistance } from './icon-hash-core';
import { type IconCategory, type MatchResult } from './icon-match';

const STORAGE_KEY = 'smite2-learned-icon-hashes-v1';

type LearnedTable = Record<IconCategory, Record<string, string>>;

function emptyTable(): LearnedTable {
  return { gods: {}, items: {}, roles: {} };
}

export function loadLearnedHashes(): LearnedTable {
  if (typeof window === 'undefined') return emptyTable();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyTable();
    const parsed = JSON.parse(raw);
    return { ...emptyTable(), ...parsed };
  } catch {
    return emptyTable();
  }
}

export function saveLearnedHash(category: IconCategory, id: string, hash: string) {
  if (typeof window === 'undefined') return;
  const table = loadLearnedHashes();
  table[category][id] = hash;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
}

export function clearLearnedHashes() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function learnedCount(): number {
  const t = loadLearnedHashes();
  return Object.values(t).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
}

/** Tight threshold - these are real confirmed crops from the actual game UI,
 * not a mismatched reference asset, so a genuine match should score very close. */
const LEARNED_MAX_DISTANCE = 12;

/**
 * Checks the user's own learned/confirmed hashes first; falls back to the
 * (less reliable, wrong-asset) precomputed reference table only if nothing
 * learned yet matches closely.
 */
export function matchIconLearned(hash: string, category: IconCategory, fallback: (hash: string, category: IconCategory) => MatchResult): MatchResult {
  const learned = loadLearnedHashes()[category];
  let best: MatchResult = null;
  for (const [id, refHash] of Object.entries(learned)) {
    const d = hammingDistance(hash, refHash);
    if (!best || d < best.distance) best = { id, distance: d };
  }
  if (best && best.distance <= LEARNED_MAX_DISTANCE) return best;
  return fallback(hash, category);
}
