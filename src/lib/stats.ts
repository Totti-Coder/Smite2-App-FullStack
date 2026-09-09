import type { Match } from '@/lib/supabase/database.types';

export type MatchWithGod = Match & {
  gods: { name: string; primary_role: string; icon_url: string | null } | null;
  enemy_god?: { name: string; icon_url: string | null; primary_role: string } | null;
  match_participants?: {
    side: 'ally' | 'enemy';
    god_id: string | null;
    role: string | null;
    gods: { name: string; icon_url: string | null } | null;
  }[];
};

function winrate(wins: number, total: number): number {
  return total === 0 ? 0 : Math.round((wins / total) * 1000) / 10;
}

// Averages only over matches where the stat was actually entered - these
// fields are all optional, so a match missing them shouldn't drag the
// average toward zero.
function avgOf(matches: MatchWithGod[], field: keyof MatchWithGod): number | null {
  const values = matches
    .map((m) => m[field])
    .filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function overallStats(matches: MatchWithGod[]) {
  const total = matches.length;
  const wins = matches.filter((m) => m.result === 'win').length;
  const kills = matches.reduce((sum, m) => sum + m.kills, 0);
  const deaths = matches.reduce((sum, m) => sum + m.deaths, 0);
  const assists = matches.reduce((sum, m) => sum + m.assists, 0);

  return {
    totalMatches: total,
    wins,
    losses: total - wins,
    winratePct: winrate(wins, total),
    avgKills: total ? kills / total : 0,
    avgDeaths: total ? deaths / total : 0,
    avgAssists: total ? assists / total : 0,
    kda: deaths === 0 ? kills + assists : (kills + assists) / deaths,
    avgGoldPerMin: avgOf(matches, 'gold_per_min'),
    avgDamageToPlayers: avgOf(matches, 'damage_to_players'),
    avgDamageTaken: avgOf(matches, 'damage_taken'),
    avgDamageMitigated: avgOf(matches, 'damage_mitigated'),
    avgWardsPlaced: avgOf(matches, 'wards_placed'),
  };
}

export function currentStreak(matches: MatchWithGod[]) {
  // matches must be sorted newest-first
  if (matches.length === 0) return { type: null as 'win' | 'loss' | null, count: 0 };
  const type = matches[0].result;
  let count = 0;
  for (const m of matches) {
    if (m.result !== type) break;
    count++;
  }
  return { type, count };
}

export function statsByGod(matches: MatchWithGod[]) {
  const map = new Map<
    string,
    { godId: string; name: string; iconUrl: string | null; games: number; wins: number }
  >();

  for (const m of matches) {
    const key = m.god_id;
    const entry = map.get(key) ?? {
      godId: key,
      name: m.gods?.name ?? key,
      iconUrl: m.gods?.icon_url ?? null,
      games: 0,
      wins: 0,
    };
    entry.games++;
    if (m.result === 'win') entry.wins++;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((g) => ({ ...g, winratePct: winrate(g.wins, g.games) }))
    .sort((a, b) => b.games - a.games);
}

export function statsByRole(matches: MatchWithGod[]) {
  const map = new Map<string, { role: string; games: number; wins: number }>();

  for (const m of matches) {
    const key = m.role_played;
    const entry = map.get(key) ?? { role: key, games: 0, wins: 0 };
    entry.games++;
    if (m.result === 'win') entry.wins++;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((r) => ({ ...r, winratePct: winrate(r.wins, r.games) }))
    .sort((a, b) => b.games - a.games);
}

export type GodRoleStat = { role: string; godId: string; name: string; iconUrl: string | null; games: number; wins: number; winratePct: number };

// Per (role, god) winrate - "which god am I actually good with in this
// specific role", not just overall. A god you occasionally off-role doesn't
// pollute their main-role numbers and vice versa.
export function statsByGodRole(matches: MatchWithGod[]): GodRoleStat[] {
  const map = new Map<
    string,
    { role: string; godId: string; name: string; iconUrl: string | null; games: number; wins: number }
  >();

  for (const m of matches) {
    const key = `${m.role_played}:${m.god_id}`;
    const entry = map.get(key) ?? {
      role: m.role_played,
      godId: m.god_id,
      name: m.gods?.name ?? m.god_id,
      iconUrl: m.gods?.icon_url ?? null,
      games: 0,
      wins: 0,
    };
    entry.games++;
    if (m.result === 'win') entry.wins++;
    map.set(key, entry);
  }

  return Array.from(map.values()).map((e) => ({ ...e, winratePct: winrate(e.wins, e.games) }));
}

// Best/worst god per role, only counting gods with at least `minGames` played
// in that role - a 1-game 100% winrate isn't a signal worth surfacing.
export function bestWorstByRole(byGodRole: GodRoleStat[], roles: readonly string[], minGames = 2) {
  return roles.map((role) => {
    const inRole = byGodRole.filter((r) => r.role === role && r.games >= minGames);
    const best = [...inRole].sort((a, b) => b.winratePct - a.winratePct || b.games - a.games)[0] ?? null;
    const worst =
      inRole.length > 1
        ? [...inRole].sort((a, b) => a.winratePct - b.winratePct || b.games - a.games)[0]
        : null;
    return { role, best, worst: worst?.godId !== best?.godId ? worst : null };
  });
}

export function statsByGameMode(matches: MatchWithGod[]) {
  const map = new Map<string, { gameMode: string; games: number; wins: number }>();

  for (const m of matches) {
    const key = m.game_mode;
    const entry = map.get(key) ?? { gameMode: key, games: 0, wins: 0 };
    entry.games++;
    if (m.result === 'win') entry.wins++;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((g) => ({ ...g, winratePct: winrate(g.wins, g.games) }))
    .sort((a, b) => b.games - a.games);
}

// Matchup winrate for ONE of your gods, broken down by direct lane opponent -
// only counts matches where enemy_god_id was actually filled in.
export function statsByMatchup(matches: MatchWithGod[]) {
  const map = new Map<
    string,
    { enemyGodId: string; name: string; iconUrl: string | null; role: string | null; games: number; wins: number }
  >();

  for (const m of matches) {
    if (!m.enemy_god_id) continue;
    const key = m.enemy_god_id;
    const entry = map.get(key) ?? {
      enemyGodId: key,
      name: m.enemy_god?.name ?? key,
      iconUrl: m.enemy_god?.icon_url ?? null,
      role: m.enemy_god?.primary_role ?? null,
      games: 0,
      wins: 0,
    };
    entry.games++;
    if (m.result === 'win') entry.wins++;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, winratePct: winrate(e.wins, e.games) }))
    .sort((a, b) => a.winratePct - b.winratePct); // worst matchups first
}

// Same idea but across ALL your gods combined - "which enemy gods give me
// trouble no matter what I'm playing".
export function statsByEnemyGod(matches: MatchWithGod[]) {
  return statsByMatchup(matches);
}

export type ParticipantGodStat = { godId: string; name: string; iconUrl: string | null; games: number; wins: number; winratePct: number };

// Winrate/frequency broken down by which god was on your team (side='ally')
// or the other team (side='enemy'), across ALL your matches - not just the
// direct lane matchup (statsByMatchup), the whole scoreboard.
export function statsByParticipant(matches: MatchWithGod[], side: 'ally' | 'enemy'): ParticipantGodStat[] {
  const map = new Map<string, { godId: string; name: string; iconUrl: string | null; games: number; wins: number }>();

  for (const m of matches) {
    for (const p of m.match_participants ?? []) {
      if (p.side !== side || !p.god_id) continue;
      const key = p.god_id;
      const entry = map.get(key) ?? {
        godId: key,
        name: p.gods?.name ?? key,
        iconUrl: p.gods?.icon_url ?? null,
        games: 0,
        wins: 0,
      };
      entry.games++;
      if (m.result === 'win') entry.wins++;
      map.set(key, entry);
    }
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, winratePct: winrate(e.wins, e.games) }))
    .sort((a, b) => b.games - a.games);
}

export type ItemUsageStat = { name: string; games: number; wins: number; winratePct: number };

// How often each item shows up across your builds, and your winrate when
// you used it - matches are stored with item NAMES (see ItemSelectGrid's
// hidden input), not catalog ids, so this key is a name too.
export function mostUsedItems(matches: MatchWithGod[]): ItemUsageStat[] {
  const map = new Map<string, { name: string; games: number; wins: number }>();

  for (const m of matches) {
    for (const name of m.items ?? []) {
      const entry = map.get(name) ?? { name, games: 0, wins: 0 };
      entry.games++;
      if (m.result === 'win') entry.wins++;
      map.set(name, entry);
    }
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, winratePct: winrate(e.wins, e.games) }))
    .sort((a, b) => b.games - a.games);
}

export function kdaTrend(matches: MatchWithGod[]) {
  // matches must be sorted oldest-first for a left-to-right trend line
  return matches.map((m) => ({
    date: m.played_at,
    kda: m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths,
  }));
}
