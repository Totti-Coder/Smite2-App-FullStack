-- Community tier lists. Unlike every other table in this app, these are
-- PUBLICLY readable (including by signed-out visitors) - that's the whole
-- point of the feature: anyone can browse everyone's lists, but you need an
-- account to publish one. Writes stay owner-scoped exactly like matches.
--
-- Deliberately NO join to auth.users for display: author_name is typed by
-- the creator instead. Rendering an email in a public gallery would leak
-- every publisher's address to the open internet, and Supabase's auth.users
-- isn't exposed to anon anyway.
create table if not exists public.tier_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 80),
  author_name text not null check (char_length(author_name) between 1 and 40),
  -- [{ id, label, color, godIds: [] }, ...] - validated in the server action
  -- (src/lib/validation/tier-list.ts) before it ever reaches this column.
  tiers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tier_lists_created_at_idx on public.tier_lists (created_at desc);
create index if not exists tier_lists_user_id_idx on public.tier_lists (user_id);

alter table public.tier_lists enable row level security;

-- Public read: anon included, on purpose.
create policy "tier_lists_select_public"
  on public.tier_lists for select
  to anon, authenticated
  using (true);

-- Publishing requires an account, and you can only publish as yourself.
create policy "tier_lists_insert_own"
  on public.tier_lists for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "tier_lists_update_own"
  on public.tier_lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tier_lists_delete_own"
  on public.tier_lists for delete
  to authenticated
  using (auth.uid() = user_id);

-- Explicit GRANTs - RLS policies alone are not enough, Postgres blocks at
-- the privilege layer first (this is exactly what broke match_participants
-- in 0007/0008; not repeating it). anon gets SELECT only.
grant select on public.tier_lists to anon;
grant select, insert, update, delete on public.tier_lists to authenticated;
grant select, insert, update, delete on public.tier_lists to service_role;
