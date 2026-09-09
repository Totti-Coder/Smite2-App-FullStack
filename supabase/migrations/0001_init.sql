-- Smite 2 personal tracker: initial schema

-- Static god catalog (populated manually, not user-owned data)
create table if not exists public.gods (
  id text primary key,                    -- slug, e.g. 'athena'
  name text not null,
  pantheon text not null,
  primary_role text not null check (primary_role in ('solo','jungle','mid','adc','support')),
  damage_type text not null check (damage_type in ('strength','intelligence')),
  icon_url text,
  created_at timestamptz not null default now()
);

-- One row per match, entered manually by the authenticated user
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  god_id text not null references public.gods(id),
  role_played text not null check (role_played in ('solo','jungle','mid','adc','support')),
  game_mode text not null check (game_mode in ('conquest_ranked','conquest_casual','arena','joust','assault','duel')),
  result text not null check (result in ('win','loss')),
  kills integer not null default 0 check (kills >= 0),
  deaths integer not null default 0 check (deaths >= 0),
  assists integer not null default 0 check (assists >= 0),
  rank_tier text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  played_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists matches_user_played_at_idx on public.matches (user_id, played_at desc);
create index if not exists matches_god_id_idx on public.matches (god_id);

-- Row Level Security: each user only ever sees/writes their own matches
alter table public.matches enable row level security;

create policy "matches_select_own" on public.matches
  for select using (auth.uid() = user_id);

create policy "matches_insert_own" on public.matches
  for insert with check (auth.uid() = user_id);

create policy "matches_update_own" on public.matches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "matches_delete_own" on public.matches
  for delete using (auth.uid() = user_id);

-- God catalog is public read-only reference data
alter table public.gods enable row level security;

create policy "gods_select_all" on public.gods
  for select using (true);

-- No insert/update/delete policies for gods -> only service_role (server-side seed script) can write
