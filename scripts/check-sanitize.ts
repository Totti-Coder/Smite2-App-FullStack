// Ad-hoc verification of the server-side validation schemas against both
// hostile and legitimate input. Run: npx tsx --tsconfig tsconfig.json scripts/check-sanitize.ts
import { matchInputSchema, participantsInputSchema } from '../src/lib/validation/match';
import { tierListInputSchema } from '../src/lib/validation/tier-list';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name, detail && !ok ? '-> ' + detail : '');
};

const baseMatch = {
  god_id: 'achilles', enemy_god_id: null, role_played: 'solo', game_mode: 'arena',
  result: 'win', kills: '5', deaths: '2', assists: '3', rank_tier: null,
  duration_seconds: null, gold_per_min: null, damage_to_players: null,
  damage_to_minions: null, damage_to_jungle: null, damage_to_structures: null,
  damage_taken: null, damage_mitigated: null, self_healing: null, ally_healing: null,
  wards_placed: null, items: null, played_at: '2026-09-09T10:00', notes: null,
};

// --- the bug that was actually losing data ---
const sevenItems = 'Adamantine Sickle,Soul Reaver,Rod of Tahuti,Book of Thoth,Obsidian Shard,Spear of Desolation,Arondight';
const r1 = matchInputSchema.safeParse({ ...baseMatch, items: sevenItems });
check('7 items se guardan enteros', r1.success && r1.data.items?.length === 7,
  r1.success ? `guardo ${r1.data.items?.length}` : 'no parseo');

// --- allowlists ---
check('god_id inventado se rechaza', !matchInputSchema.safeParse({ ...baseMatch, god_id: 'zzz_no_existe' }).success);
const r2 = matchInputSchema.safeParse({ ...baseMatch, items: 'Soul Reaver,<script>alert(1)</script>,Rod of Tahuti' });
check('item inventado se descarta, resto se conserva',
  r2.success && r2.data.items?.length === 2 && !JSON.stringify(r2.data.items).includes('script'),
  r2.success ? JSON.stringify(r2.data.items) : 'no parseo');

// --- legitimate data must survive ---
const r3 = matchInputSchema.safeParse({ ...baseMatch, notes: "Jugue con Chang'e; O'Brien iba de \"support\" -- gg", rank_tier: 'Gold III' });
check('apostrofos/comillas/guiones intactos en notes',
  r3.success && r3.data.notes === "Jugue con Chang'e; O'Brien iba de \"support\" -- gg",
  r3.success ? JSON.stringify(r3.data.notes) : 'no parseo');

// --- invisible / bidi ---
const r4 = tierListInputSchema.safeParse({
  title: 'Mi\u200B\u200B tier list\uFEFF',
  author_name: 'admin\u202Enimda',
  tiers: [{ id: 's', label: 'S\u200B', color: '#16c8d4', godIds: ['achilles'] }],
});
check('zero-width y bidi eliminados de campos publicos',
  r4.success && r4.data.title === 'Mi tier list' && r4.data.author_name === 'adminnimda' && r4.data.tiers[0].label === 'S',
  r4.success ? JSON.stringify([r4.data.title, r4.data.author_name, r4.data.tiers[0].label]) : 'no parseo');

check('color no-hex se rechaza (va a un style inline publico)',
  !tierListInputSchema.safeParse({ title: 't', author_name: 'a', tiers: [{ id: 's', label: 'S', color: 'url(javascript:alert(1))', godIds: ['achilles'] }] }).success);

const r5 = tierListInputSchema.safeParse({ title: '   \u200B\u200B\u200B   ', author_name: 'a', tiers: [{ id: 's', label: 'S', color: '#16c8d4', godIds: [] }] });
check('titulo solo-invisibles se rechaza como vacio', !r5.success);

// --- participants degrade, never wipe the whole scan ---
const r6 = participantsInputSchema.safeParse([
  { side: 'ally', godId: 'achilles', role: 'solo', items: [] },
  { side: 'enemy', godId: 'dios_falso', role: 'mid', items: [] },
]);
check('un dios irreconocible NO descarta a los demas',
  r6.success && r6.data.length === 2 && r6.data[0].godId === 'achilles' && r6.data[1].godId === null,
  r6.success ? JSON.stringify(r6.data.map(p => p.godId)) : 'no parseo');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
