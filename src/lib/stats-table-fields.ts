// Calibration for the player's OWN column on the 10-column "comparar stats"
// screen. Deliberately does NOT model the whole table's geometry (unlike
// scoreboard-fields.ts's two-block row model) - this only ever needs to
// read ONE column (yours), and which column that is shifts every match, so
// there's nothing to gain from being able to address all 10. Instead: the
// 11 stat-row positions are calibrated ONCE, relative to an arbitrary
// column box - then each future capture, the user just draws ONE box
// around wherever their own column happens to be, and those same relative
// positions are applied straight to it.
import type { OcrFieldKey } from './ocr-fields';

export type CalibBox = { xPct: number; yPct: number; wPct: number; hPct: number };

export type StatsColumnCalibration = {
  fieldsRel: Partial<Record<OcrFieldKey, CalibBox>>; // relative to an arbitrary column box (0..1 within it)
};

const STORAGE_KEY = 'smite2-stats-column-calibration-v1';

export function loadStatsColumnCalibration(): StatsColumnCalibration | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatsColumnCalibration) : null;
  } catch {
    return null;
  }
}

export function saveStatsColumnCalibration(c: StatsColumnCalibration) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function clearStatsColumnCalibration() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Resolves a column-relative sub-box (fieldsRel entry) into an absolute box, given the column box drawn for THIS capture. */
export function subBoxAt(colBox: CalibBox, rel: CalibBox): CalibBox {
  return {
    xPct: colBox.xPct + rel.xPct * colBox.wPct,
    yPct: colBox.yPct + rel.yPct * colBox.hPct,
    wPct: rel.wPct * colBox.wPct,
    hPct: rel.hPct * colBox.hPct,
  };
}

/** Converts an absolute (image-relative) box drawn during calibration into one relative to the reference column box. */
export function toColRelative(colBox: CalibBox, abs: CalibBox): CalibBox {
  return {
    xPct: (abs.xPct - colBox.xPct) / colBox.wPct,
    yPct: (abs.yPct - colBox.yPct) / colBox.hPct,
    wPct: abs.wPct / colBox.wPct,
    hPct: abs.hPct / colBox.hPct,
  };
}
