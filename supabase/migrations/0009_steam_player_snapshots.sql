-- Historical trend of Smite 2's Steam concurrent-player count, sourced
-- ONLY from Valve's own public ISteamUserStats/GetNumberOfCurrentPlayers
-- endpoint (no key required, no ToS issue - it's Valve's own official API,
-- not a scrape of a third-party tracker). Valve doesn't expose player-count
-- HISTORY via that API though, only the current instantaneous count - so
-- this table is how we build our own history: each dashboard load takes a
-- fresh sample if the last one is stale (see steam-player-count.ts), and
-- the chart just plots whatever's accumulated so far. Not owned by a
-- specific user - it's shared, app-wide data - so no user_id column.
create table if not exists public.steam_player_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_count integer not null,
  sampled_at timestamptz not null default now()
);

create index if not exists steam_player_snapshots_sampled_at_idx on public.steam_player_snapshots (sampled_at desc);

alter table public.steam_player_snapshots enable row level security;

create policy "Authenticated users can view player count history"
  on public.steam_player_snapshots for select
  to authenticated
  using (true);

create policy "Authenticated users can record player count samples"
  on public.steam_player_snapshots for insert
  to authenticated
  with check (true);

-- Explicit GRANTs, not just RLS policies - this project's tables don't get
-- them by default (see 0008's postmortem on match_participants missing
-- exactly this and silently breaking every query that touched it).
grant select, insert on public.steam_player_snapshots to authenticated;
grant select, insert on public.steam_player_snapshots to service_role;
