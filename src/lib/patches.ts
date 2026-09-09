// Smite 2 doesn't use semver-style versions (there's no "3.9") - it ships
// as OB## (Open Beta ##), roughly every 2 weeks. Hi-Rez has no API for
// this, so there's nothing to compute from the date alone - this is a
// small, manually-maintained calendar (same pattern as gods.json/items.json),
// seeded from wiki.smite2.com/w/Patch_notes on 2026-08-31.
//
// MAINTENANCE: add a new row (newest last) whenever a new OB drops - ask
// Claude to look up the date, or add it by hand. Nothing else needs to
// change; patchForDate/currentPatch derive everything from this list.
export type Patch = { id: string; label: string; startDate: string };

export const PATCHES: Patch[] = [
  { id: 'OB33', label: 'OB33', startDate: '2026-04-21' },
  { id: 'OB34', label: 'OB34', startDate: '2026-05-06' },
  { id: 'OB35', label: 'OB35', startDate: '2026-05-19' },
  { id: 'OB36', label: 'OB36', startDate: '2026-06-02' },
  { id: 'OB37', label: 'OB37', startDate: '2026-06-16' },
  { id: 'OB38', label: 'OB38', startDate: '2026-06-30' },
  { id: 'OB39', label: 'OB39', startDate: '2026-07-14' },
  { id: 'OB40', label: 'OB40', startDate: '2026-07-28' },
  { id: 'OB41', label: 'OB41', startDate: '2026-08-11' },
  { id: 'OB42', label: 'OB42', startDate: '2026-08-25' },
];

/** The patch active on a given date/timestamp - null if before the earliest entry above. */
export function patchForDate(date: Date | string): Patch | null {
  const t = new Date(date).getTime();
  let match: Patch | null = null;
  for (const p of PATCHES) {
    if (new Date(p.startDate).getTime() <= t) match = p;
    else break;
  }
  return match;
}

/** The patch active right now - null if this list hasn't been updated in a while (see MAINTENANCE above) and the real current patch is missing. */
export function currentPatch(): Patch | null {
  return patchForDate(new Date());
}
