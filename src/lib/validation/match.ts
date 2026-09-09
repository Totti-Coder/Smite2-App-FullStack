import { z } from 'zod';
import { MAX_BUILD_ITEMS } from '@/lib/item-types';
import {
  multiLineText,
  singleLineText,
  VALID_GOD_IDS,
  VALID_ITEM_NAMES,
} from '@/lib/validation/sanitize';

const roles = ['solo', 'jungle', 'mid', 'adc', 'support'] as const;
const gameModes = [
  'conquest_ranked',
  'conquest_casual',
  'arena',
  'joust',
  'assault',
  'duel',
] as const;
const results = ['win', 'loss'] as const;

// A stat pulled straight off the post-match scoreboard: big but bounded,
// never negative. 5,000,000 is a generous ceiling, not a real expectation.
const scoreboardStat = z.coerce.number().int().min(0).max(5_000_000).nullable();

// God ids are checked against the shipped catalog rather than just
// length-limited. The FK to public.gods would reject an unknown id anyway,
// but as a database error surfacing as a generic "no se pudo guardar" - this
// turns it into an accurate message and keeps the allowlist next to the rest
// of the validation.
const godId = z.string().refine((v) => VALID_GOD_IDS.has(v), 'Dios desconocido');

// Mirrors the CHECK constraints in supabase/migrations/0001_init.sql and
// 0002_detailed_stats.sql. Server-side validation is the real gate (RLS +
// this schema); client-side HTML constraints are only for UX, never trusted.
export const matchInputSchema = z.object({
  god_id: godId,
  enemy_god_id: godId.nullable(),
  role_played: z.enum(roles),
  game_mode: z.enum(gameModes),
  result: z.enum(results),
  kills: z.coerce.number().int().min(0).max(200),
  deaths: z.coerce.number().int().min(0).max(200),
  assists: z.coerce.number().int().min(0).max(200),
  // Free text by design ("Gold III"), so it gets cleaned rather than
  // allowlisted - see lib/validation/sanitize.ts for what that means.
  rank_tier: singleLineText(32).nullable(),
  duration_seconds: z.coerce.number().int().min(1).max(10800).nullable(),
  gold_per_min: scoreboardStat,
  damage_to_players: scoreboardStat,
  damage_to_minions: scoreboardStat,
  damage_to_jungle: scoreboardStat,
  damage_to_structures: scoreboardStat,
  damage_taken: scoreboardStat,
  damage_mitigated: scoreboardStat,
  self_healing: scoreboardStat,
  ally_healing: scoreboardStat,
  wards_placed: z.coerce.number().int().min(0).max(50).nullable(),
  // ItemSelectGrid submits the chosen items as their catalog NAMES joined by
  // commas (no item name contains a comma - verified against items.json), so
  // each part is checked against the catalog and anything unrecognised is
  // dropped instead of being stored as arbitrary text.
  items: z
    .string()
    .nullable()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter((s) => VALID_ITEM_NAMES.has(s))
            .slice(0, MAX_BUILD_ITEMS)
        : null
    )
    .pipe(z.array(z.string()).max(MAX_BUILD_ITEMS).nullable()),
  played_at: z.coerce.date(),
  notes: multiLineText(500).nullable(),
});

export type MatchInput = z.infer<typeof matchInputSchema>;

// Ally/enemy rows detected off the scoreboard scan (or left empty if the
// player didn't use it) - a separate schema since these land in their own
// table, not on the matches row itself.
export const participantSchema = z.object({
  side: z.enum(['ally', 'enemy']),
  // Unrecognised ids degrade to null instead of failing. These rows come from
  // OCR of a screenshot, and the whole array is parsed at once: a strict
  // refinement here would mean one misread god silently discards all ten
  // players (the caller treats a parse failure as "no participants"). An
  // unknown god is still filtered out - it just doesn't take the rest with it.
  godId: z
    .string()
    .nullable()
    .transform((v) => (v && VALID_GOD_IDS.has(v) ? v : null)),
  role: z.enum(roles).nullable(),
  items: z
    .array(z.string())
    .max(MAX_BUILD_ITEMS)
    .transform((arr) => arr.filter((name) => VALID_ITEM_NAMES.has(name))),
});

export const participantsInputSchema = z.array(participantSchema).max(20);

export type ParticipantInput = z.infer<typeof participantSchema>;
