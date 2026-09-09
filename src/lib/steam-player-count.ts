import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';

// Smite 2's Steam App ID (steamcommunity.com/app/2437170).
const SMITE2_APPID = 2437170;

// How stale the latest snapshot has to be before the dashboard bothers
// taking a fresh one. Not a rate-limit dodge (Valve doesn't document one
// for this endpoint) - just no reason to hit it on every single reload.
const SNAPSHOT_STALE_MS = 15 * 60 * 1000;

/** Live count straight from Valve's own public API - no key, no scraping. */
async function fetchCurrentPlayerCount(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${SMITE2_APPID}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: { result?: number; player_count?: number } };
    if (json.response?.result !== 1 || typeof json.response.player_count !== 'number') return null;
    return json.response.player_count;
  } catch {
    return null;
  }
}

export type PlayerSnapshot = { player_count: number; sampled_at: string };

/**
 * Takes a fresh Steam sample and stores it if the latest one on record is
 * stale (or there isn't one yet), then returns the last `hours` worth of
 * history for the chart, bucketed to one point per hour (average of
 * whatever samples landed in that hour). Valve's API only exposes the
 * CURRENT count, not a history - this is how the trend gets built up over
 * time, one dashboard visit at a time, so raw samples land ~15min apart
 * whenever the dashboard happens to be open; bucketing is what turns that
 * irregular scatter into a clean hourly chart instead of a cramped cluster
 * of points wherever the app got visited a lot. Best-effort throughout: a
 * failed fetch/insert just means the chart doesn't gain a point this visit,
 * never blocks the dashboard.
 */
export async function getPlayerCountHistory(supabase: SupabaseClient<Database>, hours = 24): Promise<PlayerSnapshot[]> {
  const { data: latest } = await supabase
    .from('steam_player_snapshots')
    .select('sampled_at')
    .order('sampled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isStale = !latest || Date.now() - new Date(latest.sampled_at).getTime() > SNAPSHOT_STALE_MS;
  if (isStale) {
    const count = await fetchCurrentPlayerCount();
    if (count != null) {
      await supabase.from('steam_player_snapshots').insert({ player_count: count });
    }
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('steam_player_snapshots')
    .select('player_count, sampled_at')
    .gte('sampled_at', since)
    .order('sampled_at', { ascending: true });

  return bucketByHour(data ?? []);
}

/** Averages every sample within the same hour into a single point, keyed by that hour's start. */
function bucketByHour(snapshots: PlayerSnapshot[]): PlayerSnapshot[] {
  const buckets = new Map<string, number[]>();
  for (const s of snapshots) {
    const hourStart = new Date(s.sampled_at);
    hourStart.setMinutes(0, 0, 0);
    const key = hourStart.toISOString();
    const values = buckets.get(key) ?? [];
    values.push(s.player_count);
    buckets.set(key, values);
  }

  return Array.from(buckets.entries())
    .map(([sampled_at, values]) => ({
      sampled_at,
      player_count: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
    }))
    .sort((a, b) => new Date(a.sampled_at).getTime() - new Date(b.sampled_at).getTime());
}
