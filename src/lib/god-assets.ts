import type { Role } from '@/lib/supabase/database.types';

// Role icon filenames on smitesource's CDN aren't consistently suffixed -
// this is the verified working set, not a derivable pattern.
const ROLE_ICON_FILE: Record<Role, string> = {
  solo: 'T_GodRole_Solo_Small.png',
  jungle: 'T_GodRole_Jungle.png',
  mid: 'T_GodRole_Mid_Small.png',
  adc: 'T_GodRole_Carry_Small.png',
  support: 'T_GodRole_Support.png',
};

export function roleIconUrl(role: Role): string {
  return `https://cdn.smitesource.com/Roles/${ROLE_ICON_FILE[role]}`;
}

export const ROLE_LABEL: Record<Role, string> = {
  solo: 'Solo',
  jungle: 'Jungle',
  mid: 'Mid',
  adc: 'ADC',
  support: 'Support',
};

export const ROLE_COLOR: Record<Role, string> = {
  solo: '#fb923c',
  jungle: '#a78bfa',
  mid: '#16c8d4',
  adc: '#34d399',
  support: '#60a5fa',
};

export const DAMAGE_TYPE_COLOR = {
  strength: '#fb923c',
  intelligence: '#a78bfa',
} as const;

export const DAMAGE_TYPE_LABEL = {
  strength: 'Physical',
  intelligence: 'Magical',
} as const;

export const GAME_MODE_LABEL: Record<string, string> = {
  conquest_ranked: 'Conquest Ranked',
  conquest_casual: 'Conquest Casual',
  arena: 'Arena',
  joust: 'Joust',
  assault: 'Assault',
  duel: 'Duel',
};

export const GAME_MODE_COLOR: Record<string, string> = {
  conquest_ranked: '#16c8d4',
  conquest_casual: '#60a5fa',
  arena: '#fb923c',
  joust: '#a78bfa',
  assault: '#34d399',
  duel: '#fb3b5c',
};
