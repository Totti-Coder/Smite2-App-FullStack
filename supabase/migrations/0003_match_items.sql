-- Items bought in a match, as entered by the player (e.g. ["Rangda's Mask", "Soul Reaver"]).
-- No items catalog table yet - free text array, capped at 6 slots.
alter table public.matches
  add column if not exists items jsonb;
