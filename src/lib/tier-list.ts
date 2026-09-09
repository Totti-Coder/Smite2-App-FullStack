// Shared shape + defaults for community tier lists. Kept framework-free so
// the server action, the validation schema and both the editor and the
// read-only renderer all agree on one definition.

export type Tier = {
  id: string;
  label: string;
  color: string;
  godIds: string[];
};

export const MAX_TIERS = 10;
export const MAX_TITLE = 80;
export const MAX_AUTHOR = 40;

// Colors picked off this app's own palette (globals.css --ss-*) rather than
// the generic rainbow other tier makers use, so a list reads as part of
// this site: loss-red at the top, through orange/amber, to cyan/purple at
// the bottom. Stored per-tier so a list keeps its look even if the defaults
// change later.
export const DEFAULT_TIERS: Tier[] = [
  { id: 's-plus', label: 'S+', color: '#fb3b5c', godIds: [] },
  { id: 's', label: 'S', color: '#fb923c', godIds: [] },
  { id: 'a', label: 'A', color: '#fbbf24', godIds: [] },
  { id: 'b', label: 'B', color: '#a3e635', godIds: [] },
  { id: 'c', label: 'C', color: '#34d399', godIds: [] },
  { id: 'd', label: 'D', color: '#16c8d4', godIds: [] },
  { id: 'e', label: 'E', color: '#a78bfa', godIds: [] },
];

export function emptyTiers(): Tier[] {
  return DEFAULT_TIERS.map((t) => ({ ...t, godIds: [] }));
}

/** God ids that haven't been placed in any tier yet. */
export function unrankedGodIds(tiers: Tier[], allGodIds: string[]): string[] {
  const placed = new Set(tiers.flatMap((t) => t.godIds));
  return allGodIds.filter((id) => !placed.has(id));
}

/** Total gods placed across every tier - drives the "N clasificados" counter. */
export function rankedCount(tiers: Tier[]): number {
  return tiers.reduce((sum, t) => sum + t.godIds.length, 0);
}
