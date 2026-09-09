-- Direct lane opponent for this match (optional) - powers matchup winrate stats.
alter table public.matches
  add column if not exists enemy_god_id text references public.gods(id);

create index if not exists matches_enemy_god_id_idx on public.matches (enemy_god_id);
