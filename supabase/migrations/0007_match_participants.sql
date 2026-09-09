-- One row per OTHER player detected on the scoreboard (allies and enemies,
-- not the user themself - their own row's data already lives on the parent
-- matches row). Powers "which ally/enemy god do I win/lose most with-against".
create table if not exists public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  side text not null check (side in ('ally', 'enemy')),
  god_id text references public.gods(id),
  role text check (role in ('solo', 'jungle', 'mid', 'adc', 'support')),
  items jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_participants_match_id_idx on public.match_participants (match_id);
create index if not exists match_participants_god_id_idx on public.match_participants (god_id);

alter table public.match_participants enable row level security;

-- No direct user_id column here on purpose - ownership is inherited from
-- the parent match, checked via the same pattern as every other RLS policy
-- in this app (subquery against matches.user_id = auth.uid()).
create policy "Users can view participants of their own matches"
  on public.match_participants for select
  to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()));

create policy "Users can insert participants into their own matches"
  on public.match_participants for insert
  to authenticated
  with check (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()));

create policy "Users can delete participants of their own matches"
  on public.match_participants for delete
  to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid()));
