// Builds the account the demo recording uses, so the GIF never shows the
// owner's real inbox.
//
// The dashboard renders `user.email` in its header. Recording a real session
// would therefore publish a personal email address into a README that is
// indexed by search engines - the kind of leak that is trivial to avoid up
// front and impossible to take back afterwards. This account exists so the
// demo has something to show that belongs to nobody.
//
// It also makes the recording REPRODUCIBLE: the charts need a dataset with
// enough shape to be worth looking at (a streak, a bad matchup, a role the
// player is clearly better at), and hand-playing 30 matches to get that is
// not something you want to repeat every time the UI changes.
//
// Requires SUPABASE_SERVICE_ROLE_KEY. That is consistent with .env.example's
// rule - the key stays inside seed scripts and never reaches the app runtime -
// and it is needed for two things the anon key genuinely cannot do: create an
// already-confirmed user, and delete one.
//
//   npx tsx --env-file=.env.local scripts/seed-demo.ts
//   npx tsx --env-file=.env.local scripts/seed-demo.ts --clean
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import type { Database } from '../src/lib/supabase/database.types';

// example.com is reserved by RFC 2606 precisely so it can be used this way: it
// can never belong to a real person, and it reads as obviously-a-demo on screen.
export const DEMO_EMAIL = 'demo@example.com';

/**
 * Everything that needs credentials is built here rather than at module level,
 * so importing this file costs nothing and demands nothing.
 *
 * capture-demo.ts imports DEMO_EMAIL from here. When the env check and the
 * client lived at the top of the module, that import alone was enough to abort
 * the caller with "Faltan NEXT_PUBLIC_SUPABASE_URL" - a script failing on a
 * dependency it never used.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Ejecuta con: npx tsx --env-file=.env.local scripts/seed-demo.ts');
    process.exit(1);
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let admin: ReturnType<typeof adminClient>;
const clean = process.argv.includes('--clean');

/**
 * The password lives in .env.local (gitignored), never in the repository.
 *
 * Committing it would be worse than it first looks: this repo is public, and
 * the Supabase project it points at is live, so a password in source is a
 * working login to a real database for anyone who reads the README. Generated
 * once and reused on later runs.
 */
function demoPassword(): string {
  const existing = process.env.DEMO_USER_PASSWORD;
  if (existing) return existing;

  const generated = randomBytes(18).toString('base64url');
  const envPath = join(import.meta.dirname, '..', '.env.local');
  appendFileSync(
    envPath,
    `\n# Cuenta de demostración para scripts/capture-demo.ts (generada automáticamente).\nDEMO_USER_PASSWORD=${generated}\n`,
    'utf8'
  );
  console.log('Contraseña de la cuenta demo generada y guardada en .env.local');
  return generated;
}

async function findDemoUser(): Promise<string | null> {
  // listUsers is paginated; the demo account is created by this script so it
  // is on the first page unless the project has many users, which is why the
  // page size is raised rather than assumed.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`);
  return data.users.find((u) => u.email === DEMO_EMAIL)?.id ?? null;
}

async function main() {
  admin = adminClient();
  const existingId = await findDemoUser();

  if (clean) {
    if (!existingId) {
      console.log('No hay cuenta demo que borrar.');
      return;
    }
    // matches (and match_participants, by cascade) and tier_lists all cascade
    // from auth.users, so deleting the user removes every row it owns.
    const { error } = await admin.auth.admin.deleteUser(existingId);
    if (error) throw new Error(`No se pudo borrar la cuenta demo: ${error.message}`);
    console.log(`Cuenta demo ${DEMO_EMAIL} y todos sus datos eliminados.`);
    return;
  }

  // The gods catalog is a foreign key target for every match below. If the
  // table is empty the inserts fail with a FK violation that reads like a bug
  // in this script, so check it explicitly and say what to run instead.
  const { count: godCount, error: godErr } = await admin
    .from('gods')
    .select('id', { count: 'exact', head: true });
  if (godErr) throw new Error(`No se pudo leer el catálogo de dioses: ${godErr.message}`);
  if (!godCount) {
    console.error('La tabla `gods` está vacía. Ejecuta primero: npm run seed:gods');
    process.exit(1);
  }

  const password = demoPassword();
  let userId = existingId;

  if (userId) {
    // Keep the stored password authoritative: if .env.local was regenerated,
    // the account must still be loggable-in with what capture-demo will read.
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(`No se pudo actualizar la cuenta demo: ${error.message}`);
    console.log(`Cuenta demo existente reutilizada (${DEMO_EMAIL}).`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password,
      // Skips the confirmation email, which has nowhere to go: example.com has
      // no mail server by design.
      email_confirm: true,
    });
    if (error) throw new Error(`No se pudo crear la cuenta demo: ${error.message}`);
    userId = data.user.id;
    console.log(`Cuenta demo creada (${DEMO_EMAIL}).`);
  }

  // Idempotent: wipe this account's own rows before reseeding, so running the
  // script twice doesn't double the dataset and skew every chart.
  await admin.from('matches').delete().eq('user_id', userId);
  await admin.from('tier_lists').delete().eq('user_id', userId);

  const matches = buildMatches(userId);
  const { data: inserted, error: insertErr } = await admin
    .from('matches')
    .insert(matches.map((m) => m.row))
    .select('id');
  if (insertErr) throw new Error(`No se pudieron insertar las partidas: ${insertErr.message}`);

  const participants = inserted.flatMap((row, i) =>
    matches[i].participants.map((p) => ({ ...p, match_id: row.id }))
  );
  const { error: partErr } = await admin.from('match_participants').insert(participants);
  if (partErr) throw new Error(`No se pudieron insertar los participantes: ${partErr.message}`);

  const { error: tierErr } = await admin.from('tier_lists').insert({
    user_id: userId,
    title: 'Conquest S3 - Mejores junglas',
    author_name: 'Demo',
    tiers: DEMO_TIERS,
  });
  if (tierErr) throw new Error(`No se pudo insertar la tier list: ${tierErr.message}`);

  const wins = matches.filter((m) => m.row.result === 'win').length;
  console.log(
    `Sembrado: ${matches.length} partidas (${wins}V/${matches.length - wins}D), ` +
      `${participants.length} participantes, 1 tier list.`
  );
}

// --- the dataset ----------------------------------------------------------

type Row = Database['public']['Tables']['matches']['Insert'];
type Part = Omit<Database['public']['Tables']['match_participants']['Insert'], 'match_id'>;

/**
 * Hand-shaped rather than randomised, because random data produces boring
 * charts: every winrate lands near 50%, no god stands out, no streak forms,
 * and the "mejor y peor dios por rol" panel renders empty. The numbers below
 * are plausible Smite 2 Conquest lines, arranged so each dashboard panel has
 * something real to say.
 */
const PLAN: [god: string, role: Role, mode: Mode, result: 'win' | 'loss', k: number, d: number, a: number, enemy: string][] = [
  // Jungle is the strong role - clearly best winrate, carries the leaderboard.
  ['hun_batz', 'jungle', 'conquest_ranked', 'win', 12, 4, 9, 'thor'],
  ['hun_batz', 'jungle', 'conquest_ranked', 'win', 9, 3, 11, 'fenrir'],
  ['hun_batz', 'jungle', 'conquest_casual', 'loss', 5, 8, 6, 'susano'],
  ['hun_batz', 'jungle', 'conquest_ranked', 'win', 14, 2, 7, 'bastet'],
  ['thor', 'jungle', 'conquest_ranked', 'win', 8, 5, 13, 'hun_batz'],
  ['thor', 'jungle', 'conquest_ranked', 'win', 11, 6, 8, 'awilix'],
  ['thor', 'jungle', 'conquest_casual', 'win', 7, 4, 10, 'mercury'],
  ['fenrir', 'jungle', 'conquest_ranked', 'loss', 6, 9, 5, 'hun_batz'],
  ['fenrir', 'jungle', 'conquest_ranked', 'win', 10, 5, 9, 'thor'],

  // Mid is the weak role - the "peor" half of the role panel needs a loser.
  ['agni', 'mid', 'conquest_ranked', 'loss', 4, 9, 6, 'scylla'],
  ['agni', 'mid', 'conquest_ranked', 'loss', 6, 8, 4, 'kukulkan'],
  ['agni', 'mid', 'conquest_casual', 'win', 9, 5, 8, 'poseidon'],
  ['scylla', 'mid', 'conquest_ranked', 'win', 11, 4, 6, 'agni'],
  ['scylla', 'mid', 'conquest_ranked', 'loss', 5, 7, 7, 'kukulkan'],
  ['kukulkan', 'mid', 'conquest_ranked', 'loss', 3, 8, 9, 'scylla'],

  // Scylla as a direct opponent is the standout bad matchup.
  ['agni', 'mid', 'conquest_ranked', 'loss', 2, 10, 3, 'scylla'],
  ['kukulkan', 'mid', 'conquest_casual', 'loss', 4, 9, 5, 'scylla'],

  ['neith', 'adc', 'conquest_ranked', 'win', 13, 3, 8, 'anhur'],
  ['neith', 'adc', 'conquest_ranked', 'loss', 7, 7, 6, 'artemis'],
  ['neith', 'adc', 'conquest_casual', 'win', 15, 2, 5, 'cupid'],
  ['anhur', 'adc', 'conquest_ranked', 'win', 10, 6, 7, 'neith'],
  ['artemis', 'adc', 'conquest_ranked', 'loss', 5, 9, 4, 'anhur'],

  ['ymir', 'support', 'conquest_ranked', 'win', 2, 7, 21, 'geb'],
  ['ymir', 'support', 'conquest_ranked', 'win', 1, 6, 18, 'khepri'],
  ['ymir', 'support', 'conquest_casual', 'loss', 3, 9, 12, 'athena'],
  ['khepri', 'support', 'conquest_ranked', 'win', 0, 5, 24, 'ymir'],
  ['athena', 'support', 'conquest_ranked', 'loss', 2, 8, 14, 'geb'],

  ['chaac', 'solo', 'conquest_ranked', 'win', 7, 5, 9, 'bellona'],
  ['chaac', 'solo', 'conquest_ranked', 'loss', 4, 8, 6, 'hercules'],
  ['bellona', 'solo', 'conquest_ranked', 'win', 9, 4, 7, 'chaac'],
  ['bellona', 'solo', 'conquest_casual', 'win', 8, 6, 10, 'osiris'],
  ['osiris', 'solo', 'conquest_ranked', 'loss', 5, 7, 8, 'bellona'],

  // Ix Chel is the one god that ships a 3D model (lib/god-models.ts), so she
  // is the only god page that renders the orbital build view. Without matches
  // on her, that view shows six "Vacío" slots - the single most visual screen
  // in the app, empty.
  ['ix_chel', 'mid', 'conquest_ranked', 'win', 10, 4, 12, 'agni'],
  ['ix_chel', 'mid', 'conquest_ranked', 'win', 8, 5, 15, 'poseidon'],
  ['ix_chel', 'mid', 'conquest_casual', 'loss', 6, 7, 9, 'scylla'],

  // A couple of non-Conquest modes so the mode pie chart isn't a single slice.
  ['neith', 'adc', 'arena', 'win', 18, 7, 22, 'anhur'],
  ['ymir', 'support', 'joust', 'win', 5, 6, 19, 'ares'],
  // Most recent three are wins, so the dashboard opens on a 3-win streak.
  ['hun_batz', 'jungle', 'conquest_ranked', 'win', 13, 3, 10, 'fenrir'],
  ['thor', 'jungle', 'conquest_ranked', 'win', 10, 4, 12, 'susano'],
  ['neith', 'adc', 'conquest_ranked', 'win', 16, 2, 9, 'artemis'],
];

type Role = 'solo' | 'jungle' | 'mid' | 'adc' | 'support';
type Mode = 'conquest_ranked' | 'conquest_casual' | 'arena' | 'joust';

const BUILDS: Record<string, string[]> = {
  jungle: ['Jotunn’s Vigor', 'Hydra’s Lament', 'Heartseeker', 'Serrated Edge', 'Brawler’s Ruin'],
  mid: ['Book of Thoth', 'Spear of Desolation', 'Soul Reaver', 'Rod of Tahuti', 'Obsidian Shard'],
  adc: ['Devourer’s Gauntlet', 'Ninja Tabi', 'Qin’s Blade', 'Deathbringer', 'Titan’s Bane'],
  support: ['Sentinel’s Gift', 'Gauntlet of Thebes', 'Spirit Robe', 'Mantle of Discord', 'Pridwen'],
  solo: ['Warrior’s Axe', 'Gladiator’s Shield', 'Breastplate of Valor', 'Blackthorn Hammer', 'Mantle of Discord'],
};

// Filler for the ally/enemy panels - the four teammates and four non-lane
// opponents the scanner would have read off the scoreboard.
const FILL: Record<Role, string[]> = {
  solo: ['chaac', 'bellona', 'osiris'],
  jungle: ['thor', 'fenrir', 'awilix'],
  mid: ['scylla', 'agni', 'poseidon'],
  adc: ['neith', 'anhur', 'cupid'],
  support: ['ymir', 'khepri', 'geb'],
};

const ROLES: Role[] = ['solo', 'jungle', 'mid', 'adc', 'support'];

function buildMatches(userId: string): { row: Row; participants: Part[] }[] {
  // Spread backwards from "yesterday" so played_at is always in the past, at
  // roughly one match every day and a half.
  const start = Date.now() - 24 * 60 * 60 * 1000;

  return PLAN.map(([god, role, mode, result, kills, deaths, assists, enemy], i) => {
    const playedAt = new Date(start - (PLAN.length - 1 - i) * 36 * 60 * 60 * 1000);
    const duration = 1500 + ((i * 137) % 900); // 25-40 min
    const win = result === 'win';

    const row: Row = {
      user_id: userId,
      god_id: god,
      enemy_god_id: enemy,
      role_played: role,
      game_mode: mode,
      result,
      kills,
      deaths,
      assists,
      rank_tier: mode === 'conquest_ranked' ? 'Platino III' : null,
      duration_seconds: duration,
      played_at: playedAt.toISOString(),
      gold_per_min: Math.round((win ? 560 : 470) + ((i * 29) % 90)),
      damage_to_players: Math.round((win ? 48000 : 34000) + ((i * 1733) % 16000)),
      damage_to_minions: Math.round(60000 + ((i * 3119) % 90000)),
      damage_to_jungle: Math.round(12000 + ((i * 911) % 20000)),
      damage_to_structures: Math.round((win ? 11000 : 4500) + ((i * 677) % 7000)),
      damage_taken: Math.round(38000 + ((i * 1301) % 25000)),
      damage_mitigated: Math.round((role === 'support' || role === 'solo' ? 52000 : 24000) + ((i * 853) % 18000)),
      self_healing: Math.round(4000 + ((i * 397) % 9000)),
      ally_healing: role === 'support' ? Math.round((i * 311) % 6000) : 0,
      wards_placed: role === 'support' ? 9 + (i % 7) : 2 + (i % 4),
      items: BUILDS[role],
      notes: null,
      screenshot_path: null,
    };

    // Four allies and five enemies, skipping the role the user played (ally
    // side) and the direct opponent (already on the match row).
    const participants: Part[] = [];
    for (const r of ROLES) {
      if (r !== role) participants.push({ side: 'ally', god_id: pick(FILL[r], i), role: r, items: null });
      if (r === role) participants.push({ side: 'enemy', god_id: enemy, role: r, items: null });
      else participants.push({ side: 'enemy', god_id: pick(FILL[r], i + 1), role: r, items: null });
    }

    return { row, participants };
  });
}

// Deterministic rotation, so reseeding produces the same dataset and the
// recorded GIF stays reproducible.
function pick(pool: string[], i: number): string {
  return pool[i % pool.length];
}

const DEMO_TIERS = [
  { id: 's', label: 'S', color: '#f87171', godIds: ['hun_batz', 'thor', 'susano'] },
  { id: 'a', label: 'A', color: '#fb923c', godIds: ['fenrir', 'awilix', 'mercury'] },
  { id: 'b', label: 'B', color: '#fbbf24', godIds: ['bastet', 'kali'] },
  { id: 'c', label: 'C', color: '#34d399', godIds: ['nemesis'] },
];

// Only when run directly. capture-demo.ts imports DEMO_EMAIL from this file,
// and without this guard that import re-ran the whole seed - writing to the
// database as a side effect of reading a constant. It was harmless here only
// because the seed is idempotent; with --clean in argv it would have deleted
// the account the recording was about to use.
const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  // Fails loudly: a half-seeded account makes for a confusing recording.
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
