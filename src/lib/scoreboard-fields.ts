export type CalibBox = { xPct: number; yPct: number; wPct: number; hPct: number };

export type ScoreboardCalibration = {
  // Two SEPARATE blocks of 5 evenly-spaced rows, not one uniform block of
  // 10 - the scoreboard has a header divider ("E M A Oro Objetos") between
  // the ally and enemy teams that takes up its own chunk of height. Treating
  // all 10 rows as evenly spaced (smoothing that header gap across all 9
  // steps) is what caused rows to drift off their real position the further
  // from row 1 they were - this two-block model is the actual table shape.
  row1: CalibBox; // ally block, top row - also the reference unit for the *Rel boxes below
  allySpacingPct: number; // (row5.y - row1.y) / 4
  enemyRow1: CalibBox; // enemy block, top row
  enemySpacingPct: number; // (row10.y - enemyRow1.y) / 4
  portraitRel: CalibBox; // relative to a single row's own box (0..1 within the row)
  nameRel: CalibBox; // the god's NAME as printed text - the primary god signal, see god-name-match.ts
  roleRel: CalibBox;
  itemsRel: CalibBox; // the items strip - only ever read for the player's OWN row, not all 10
};

export const SCOREBOARD_ROWS = 10;
// Smite 2 builds have 7 item slots (not 6 - that was Smite 1), the active
// relic isn't part of this strip.
export const ITEM_SLOTS_PER_ROW = 7;

// Bumped to v5 for nameRel: gods are now identified by OCR'ing the name
// text the scoreboard prints (see god-name-match.ts), with the portrait
// hash demoted to a fallback - reading a word Tesseract is good at beats
// comparing a 64-bit hash of detailed character art against 87 rivals.
// A v4 calibration has no nameRel, so it's intentionally NOT migrated,
// just treated as "not calibrated yet".
const STORAGE_KEY = 'smite2-scoreboard-calibration-v5';

export function loadScoreboardCalibration(): ScoreboardCalibration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScoreboardCalibration) : null;
  } catch {
    return null;
  }
}

export function saveScoreboardCalibration(c: ScoreboardCalibration) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function clearScoreboardCalibration() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Absolute (image-relative) box for row index i (0-based, 0-4 = ally, 5-9 = enemy). */
export function rowBoxAt(c: ScoreboardCalibration, i: number): CalibBox {
  if (i < 5) return { ...c.row1, yPct: c.row1.yPct + i * c.allySpacingPct };
  const j = i - 5;
  return { ...c.enemyRow1, yPct: c.enemyRow1.yPct + j * c.enemySpacingPct };
}

/** Resolves a row-relative sub-box (portraitRel etc.) into an absolute (image-relative) box for row i. */
export function subBoxAt(c: ScoreboardCalibration, rel: CalibBox, i: number): CalibBox {
  const row = rowBoxAt(c, i);
  return {
    xPct: row.xPct + rel.xPct * row.wPct,
    yPct: row.yPct + rel.yPct * row.hPct,
    wPct: rel.wPct * row.wPct,
    hPct: rel.hPct * row.hPct,
  };
}

/** Converts an absolute (image-relative) box drawn during calibration into one relative to row1's own box. */
export function toRowRelative(row1: CalibBox, abs: CalibBox): CalibBox {
  return {
    xPct: (abs.xPct - row1.xPct) / row1.wPct,
    yPct: (abs.yPct - row1.yPct) / row1.hPct,
    wPct: abs.wPct / row1.wPct,
    hPct: abs.hPct / row1.hPct,
  };
}
