-- 0007 created match_participants but forgot the explicit privilege GRANTs
-- that this project's tables need (see 0004's god_abilities grants for the
-- same pattern) - RLS policies alone aren't enough, Postgres blocks access
-- at the privilege layer before RLS is even evaluated. Without this,
-- Postgres returned "permission denied for table match_participants" to
-- EVERY role (authenticated included, not just service_role), which broke
-- the dashboard's and /partidas's queries outright wherever they embed
-- match_participants(...) alongside matches - the whole query errors, so
-- the page silently rendered zero matches even though the matches row
-- itself saved fine.
grant select, insert, delete on public.match_participants to authenticated;
grant select, insert, update, delete on public.match_participants to service_role;
