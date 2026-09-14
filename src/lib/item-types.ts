/**
 * Items in a completed Smite 2 build: 6 regular slots plus the active/relic
 * slot. Single source of truth because it was previously written out in three
 * places that disagreed - the picker and the scoreboard scanner allowed 7
 * while the server-side validation schema still capped at 6, so a full build's
 * seventh item was silently dropped on save.
 */
export const MAX_BUILD_ITEMS = 7;

export type Item = {
  id: string;
  name: string;
  icon_url: string | null;
  tier: string;
  cost: number;
  stats: Record<string, number> | null;
  passive: string | null;
  active: string | null;
  owner_god: string | null;
};
