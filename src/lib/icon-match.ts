'use client';

import { dHashFromRgb, hammingDistance, HASH_WIDTH, HASH_HEIGHT } from './icon-hash-core';
import iconHashes from '@/data/icon-hashes.json';

export type IconCategory = 'gods' | 'items' | 'roles';

/** Hashes a same-origin canvas region (a crop of the user's own uploaded screenshot -
 * never a cross-origin reference image, so this never hits a canvas-tainted/CORS wall). */
export function hashCanvasRegion(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = HASH_WIDTH;
  canvas.height = HASH_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, HASH_WIDTH, HASH_HEIGHT);
  const { data } = ctx.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT); // RGBA
  const rgb = new Uint8ClampedArray(HASH_WIDTH * HASH_HEIGHT * 3);
  for (let i = 0, o = 0; i < data.length; i += 4, o += 3) {
    rgb[o] = data[i];
    rgb[o + 1] = data[i + 1];
    rgb[o + 2] = data[i + 2];
  }
  return dHashFromRgb(rgb);
}

export type MatchResult = { id: string; distance: number } | null;

/** distance is out of 64 bits - under ~10 is a confident match for icon-sized
 * crops, 10-20 is "probably right, flag for review". maxDistance is a
 * generous "not pure noise" ceiling (40/64 is close to what two UNRELATED
 * images score by chance), not a strict cutoff - every scanned row is
 * already user-reviewable/editable before it's applied, so surfacing a
 * best-effort guess with a visible low-confidence flag is strictly more
 * useful than silently returning nothing and making the user search all 88
 * gods by hand. */
export function matchIcon(hash: string, category: IconCategory, maxDistance = 40): MatchResult {
  const table = (iconHashes as Record<IconCategory, Record<string, string>>)[category];
  let best: MatchResult = null;
  for (const [id, refHash] of Object.entries(table)) {
    const d = hammingDistance(hash, refHash);
    if (!best || d < best.distance) best = { id, distance: d };
  }
  return best && best.distance <= maxDistance ? best : null;
}

export const CONFIDENCE_HIGH = 10;
export const CONFIDENCE_LOW = 20;

export function confidenceLevel(distance: number): 'high' | 'medium' | 'low' {
  if (distance <= CONFIDENCE_HIGH) return 'high';
  if (distance <= CONFIDENCE_LOW) return 'medium';
  return 'low';
}

/** A near-blank/empty item slot (dark flat background) has almost no internal
 * gradient - dHash relies entirely on gradients, so a blank slot's hash is
 * meaningless noise. Skip matching it rather than returning a false positive. */
export function isLikelyEmptySlot(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 8, 8);
  const { data } = ctx.getImageData(0, 0, 8, 8);
  let sum = 0;
  let sumSq = 0;
  const n = 64;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += l;
    sumSq += l * l;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  // Real item icons (detailed art + a tier-colored border) almost always
  // score well above this - only a genuinely flat/empty background slot
  // should. Was 40, which was catching some real items too (icons with a
  // lot of one dominant color) and silently dropping them before matchIcon
  // ever got a chance - a false "empty" here is strictly worse than a
  // false "not empty" (which just costs one wasted, harmless hash compare).
  return variance < 15;
}
