-- Static per-god ability data (name, type, description, scaling numbers).
-- Game reference data, not user-owned - same read-all/service_role-write
-- pattern as `gods`. Populated lazily per god via scripts/seed-abilities.mjs,
-- not eagerly for all 88 (not worth scraping gods nobody looks up).
create table if not exists public.god_abilities (
  id uuid primary key default gen_random_uuid(),
  god_id text not null references public.gods(id) on delete cascade,
  sort_order integer not null,
  name text not null,
  ability_type text not null,
  description text not null,
  icon_url text,
  stats jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (god_id, sort_order)
);

create index if not exists god_abilities_god_id_idx on public.god_abilities (god_id);

alter table public.god_abilities enable row level security;

create policy "god_abilities_select_all" on public.god_abilities
  for select using (true);

grant select on public.god_abilities to anon, authenticated, service_role;
grant insert, update, delete on public.god_abilities to service_role;
