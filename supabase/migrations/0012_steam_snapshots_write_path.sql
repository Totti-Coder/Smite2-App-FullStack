-- Closes the only write path in this app where a user could write rows that
-- aren't theirs.
--
-- 0009 shipped this table with `for insert to authenticated with check (true)`
-- plus `grant insert to authenticated`. The reasoning was "it's shared app-wide
-- data, not owned by a user, so there's no user_id to scope it by" - true about
-- ownership, but it answered the wrong question. The question isn't who OWNS a
-- player-count sample, it's who may WRITE one, and the answer is: only the
-- server, which is the only party that actually talked to Valve.
--
-- Why RLS alone cannot fix this: the app server writes with the anon key plus
-- the visitor's own session - the exact same credentials the browser has. The
-- anon key ships in the client bundle by design (it is not a secret; RLS is
-- what protects data). So to Postgres, an insert from our dashboard render and
-- an insert from `curl` are indistinguishable - same role, same JWT shape. Any
-- policy that lets one through lets the other through. With `with check (true)`
-- that meant any account holder could POST to
-- /rest/v1/steam_player_snapshots directly and:
--   * set any player_count (no range constraint existed), poisoning a chart
--     every signed-in user sees;
--   * set any sampled_at - the column has `default now()`, but a default only
--     fills a value that wasn't sent, it does not stop one being sent - so
--     history could be fabricated backwards;
--   * insert without limit, which on a free-tier project is a cheap way to
--     fill the database.
--
-- The fix is to stop the client role writing the table at all and put the one
-- legitimate write behind a security-definer function, which becomes the only
-- door. The function - not the caller - decides the timestamp, bounds the
-- value, and enforces the sampling interval, so a tampered caller can no
-- longer choose any of the three. The remaining capability is "submit one
-- in-range count per interval", down from "submit anything, unlimited".
--
-- The alternative was a service-role key in the app runtime. Rejected: it
-- bypasses RLS on every table, it would have to exist in the deployment
-- environment, and .env.example states the key is never used outside the seed
-- scripts. A function scoped to one insert is far less to hand out.

-- 1. Take the table away from the client role.
drop policy if exists "Authenticated users can record player count samples" on public.steam_player_snapshots;
revoke insert on public.steam_player_snapshots from authenticated;

-- Reading stays as it was: the chart lives on the dashboard, which is gated.
-- (0009 granted select to authenticated only; anon was never included.)

-- 2. Bound the column itself, so the constraint also covers writes that don't
--    go through the function at all - the seed scripts, service_role, a
--    hand-run statement in the SQL editor. Defense in depth against a typo,
--    not against an attacker.
--
--    Deliberately NOT constraining sampled_at to the past: a CHECK containing
--    now() is non-immutable, so existing rows silently become "invalid" to any
--    later operation that revalidates the constraint. The function pins the
--    timestamp instead, which is the right layer for it.
--    Keep this bound and the one inside the function in step. They are not
--    redundant: the function raises, so a bug in our caller is loud, while the
--    constraint is the silent backstop for every other write path. The
--    constraint must never be TIGHTER than the function's check, or the
--    function would pass a value the table then rejects.
do $$
begin
  -- Matched on (table, name), not name alone - constraint names are unique
  -- per table, not per database.
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.steam_player_snapshots'::regclass
      and conname = 'steam_player_snapshots_player_count_sane'
  ) then
    alter table public.steam_player_snapshots
      add constraint steam_player_snapshots_player_count_sane
      check (player_count >= 0 and player_count <= 10000000);
  end if;
end $$;

-- 3. The only remaining write path.
--
-- Returns true when it stored the sample, false when a recent one already
-- existed - so the caller can tell "declined as too soon" from an error,
-- rather than inferring it.
create or replace function public.record_steam_player_sample(p_player_count integer)
returns boolean
language plpgsql
security definer
-- Empty search_path is mandatory for a security-definer function: without it
-- the caller controls name resolution and could shadow an unqualified table or
-- function with one of their own, which then runs as the function's owner.
-- Every non-catalog name below is therefore schema-qualified. (pg_catalog is
-- searched implicitly regardless, but it is qualified too, for the reader.)
set search_path = ''
as $$
declare
  -- Sampling floor. This is the ENFORCED one. steam-player-count.ts has its
  -- own matching window, but that one exists only to skip a pointless HTTP
  -- call to Valve - it runs in the client role's request and is therefore
  -- advisory. Do not "deduplicate" these two: they do different jobs, and
  -- deleting this one reopens unbounded inserts.
  v_min_interval constant interval := interval '15 minutes';
begin
  -- A tampered caller can't reach here with nonsense, because this is the only
  -- write door - but raise rather than clamp, so a genuine bug in our own
  -- caller surfaces loudly instead of silently storing a wrong number.
  if p_player_count is null or p_player_count < 0 or p_player_count > 10000000 then
    raise exception 'record_steam_player_sample: player_count out of range (%)', p_player_count;
  end if;

  -- Serializes concurrent callers. The staleness test below is a read followed
  -- by a write, and under READ COMMITTED two simultaneous dashboard renders
  -- each fail to see the other's uncommitted row - so both would pass the test
  -- and both would insert. The consequence is mild (two samples an instant
  -- apart, which the hourly bucketing averages away) but the interval is also
  -- the rate limit, and a rate limit that a burst of parallel requests can
  -- step over isn't one. The lock is held to end of transaction and costs
  -- nothing here, since this function is called at most once per interval.
  --
  -- The key is an arbitrary constant; it only has to be unique among advisory
  -- locks this application takes.
  perform pg_catalog.pg_advisory_xact_lock(4873219);

  if exists (
    select 1
    from public.steam_player_snapshots
    where sampled_at > pg_catalog.now() - v_min_interval
  ) then
    return false;
  end if;

  -- sampled_at is left to its column default on purpose: the caller does not
  -- get to say when the sample was taken.
  insert into public.steam_player_snapshots (player_count) values (p_player_count);
  return true;
end;
$$;

-- Postgres grants EXECUTE on a new function to PUBLIC by default. For a
-- security-definer function that default is the whole vulnerability back again
-- (anon could call it), so it is revoked before anything is granted.
revoke all on function public.record_steam_player_sample(integer) from public;
grant execute on function public.record_steam_player_sample(integer) to authenticated;
grant execute on function public.record_steam_player_sample(integer) to service_role;

-- The reasoning above lives in a file nobody reads from inside Supabase Studio,
-- so the short version travels with the function itself.
comment on function public.record_steam_player_sample(integer) is
  'Only write path into steam_player_snapshots: the client role has no INSERT on the table. Decides sampled_at itself, bounds player_count, and enforces a 15-minute sampling interval under an advisory lock. Returns false when a recent sample already exists.';
