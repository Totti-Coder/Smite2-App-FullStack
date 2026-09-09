-- Optional detailed combat stats, matching the in-game post-match scoreboard.
-- All nullable: the quick-entry form only requires K/D/A, these are extra.

alter table public.matches
  add column if not exists gold_per_min integer check (gold_per_min is null or gold_per_min >= 0),
  add column if not exists damage_to_players integer check (damage_to_players is null or damage_to_players >= 0),
  add column if not exists damage_to_minions integer check (damage_to_minions is null or damage_to_minions >= 0),
  add column if not exists damage_to_jungle integer check (damage_to_jungle is null or damage_to_jungle >= 0),
  add column if not exists damage_to_structures integer check (damage_to_structures is null or damage_to_structures >= 0),
  add column if not exists damage_taken integer check (damage_taken is null or damage_taken >= 0),
  add column if not exists damage_mitigated integer check (damage_mitigated is null or damage_mitigated >= 0),
  add column if not exists self_healing integer check (self_healing is null or self_healing >= 0),
  add column if not exists ally_healing integer check (ally_healing is null or ally_healing >= 0),
  add column if not exists wards_placed integer check (wards_placed is null or wards_placed >= 0);
