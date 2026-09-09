export type OcrFieldKey =
  | 'kda'
  | 'gold_per_min'
  | 'damage_to_players'
  | 'damage_to_minions'
  | 'damage_to_jungle'
  | 'damage_to_structures'
  | 'damage_taken'
  | 'damage_mitigated'
  | 'self_healing'
  | 'ally_healing'
  | 'wards_placed';

export type OcrField = {
  key: OcrFieldKey;
  label: string;
  targetIds: string[];
  parse: 'int' | 'kda';
};

export const OCR_FIELDS: OcrField[] = [
  { key: 'kda', label: 'Kills/Deaths/Assists (K/D/A)', targetIds: ['kills', 'deaths', 'assists'], parse: 'kda' },
  { key: 'gold_per_min', label: 'Oro/min', targetIds: ['gold_per_min'], parse: 'int' },
  { key: 'damage_to_players', label: 'Daño a jugador', targetIds: ['damage_to_players'], parse: 'int' },
  { key: 'damage_to_minions', label: 'Daño a súbditos', targetIds: ['damage_to_minions'], parse: 'int' },
  { key: 'damage_to_jungle', label: 'Daño en jungla', targetIds: ['damage_to_jungle'], parse: 'int' },
  { key: 'damage_to_structures', label: 'Daño a estructuras', targetIds: ['damage_to_structures'], parse: 'int' },
  { key: 'damage_taken', label: 'Daño recibido', targetIds: ['damage_taken'], parse: 'int' },
  { key: 'damage_mitigated', label: 'Daño mitigado', targetIds: ['damage_mitigated'], parse: 'int' },
  { key: 'self_healing', label: 'Autocuración', targetIds: ['self_healing'], parse: 'int' },
  { key: 'ally_healing', label: 'Curación de aliado', targetIds: ['ally_healing'], parse: 'int' },
  { key: 'wards_placed', label: 'Centinelas', targetIds: ['wards_placed'], parse: 'int' },
];

export type CalibrationBox = { key: OcrFieldKey; xPct: number; yPct: number; wPct: number; hPct: number };

const STORAGE_KEY = 'smite2-ocr-calibration-v1';

export function loadCalibration(): CalibrationBox[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCalibration(boxes: CalibrationBox[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
}

export function clearCalibration() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Parses raw OCR text for a field into number(s). Returns null entries it couldn't read. */
export function parseOcrText(field: OcrField, text: string): (number | null)[] {
  if (field.parse === 'kda') {
    const parts = text
      .trim()
      .split(/[^0-9]+/)
      .filter(Boolean);
    return [0, 1, 2].map((i) => (parts[i] ? Number(parts[i]) : null));
  }
  const digits = text.replace(/[^0-9]/g, '');
  return [digits ? Number(digits) : null];
}
