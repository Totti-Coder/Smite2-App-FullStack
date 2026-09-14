// Seeds src/data/abilities/<god-id>.json into the god_abilities table.
// Usage: npm run seed:abilities -- apollo
//
// To add a new god: open its SmiteSource page (smitesource.com/god/<slug>),
// open devtools console, and run the extraction snippet in
// scripts/extract-abilities-snippet.js (or ask Claude to do it) - it pulls
// the exact ability JSON straight out of the page's own RSC payload, no
// guessing/OCR involved. Save the result as src/data/abilities/<god-id>.json
// with the same shape as the existing files, then run this script.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const godId = process.argv[2];
if (!godId) {
  console.error('Usage: npm run seed:abilities -- <god-id>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const dataPath = path.join(__dirname, '..', 'src', 'data', 'abilities', `${godId}.json`);
let raw;
try {
  raw = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch {
  console.error(`No data file at ${dataPath}. See the comment at the top of this script.`);
  process.exit(1);
}

const ABILITY_CODE_LABEL = { PSV: 'Passive', Inhand: 'Basic Attack', A01: 'Ability 1', A02: 'Ability 2', A03: 'Ability 3', A04: 'Ability 4' };
const SORT_ORDER = { PSV: 0, Inhand: 1, A01: 2, A02: 3, A03: 4, A04: 5 };
// Most gods' pages set abilityCode directly, but a handful (stance/aspect
// swap kits like Rama) leave it null and only populate `slot` - fall back to
// deriving the code from slot so those gods don't end up with a literal
// null ability_type in the DB.
const SLOT_CODE = { 0: 'PSV', 1: 'A01', 2: 'A02', 3: 'A03', 4: 'A04', 100: 'Inhand' };

const allRows = raw.map((a) => {
  const code = a.abilityCode ?? SLOT_CODE[a.slot] ?? null;
  return {
    god_id: godId,
    sort_order: SORT_ORDER[code] ?? a.slot,
    name: a.name,
    ability_type: ABILITY_CODE_LABEL[code] ?? code ?? 'Ability',
    description: a.description,
    // Guarded: an unconditional template turns a missing imgPath into the
    // literal string "null" inside the URL, which renders as a broken image.
    // AbilitiesList already draws a clean placeholder for a null icon, so
    // pass null through and let it do that.
    icon_url: a.imgPath
      ? `https://cdn.smitesource.com/cdn-cgi/image/width=96,format=auto,quality=75/${a.imgPath}`
      : null,
    stats: { levelStats: a.levelStats, namedFormulas: a.namedFormulas, namedValueScalings: a.namedValueScalings },
    notes: (a.notes ?? []).join('\n') || null,
  };
});

// Some gods list alternate/empowered variants of an ability sharing the same
// slot (e.g. a talent-swapped form). The table has one row per
// (god_id, sort_order), so keep only the first entry seen per sort_order.
const seenSortOrders = new Set();
const rows = [];
for (const row of allRows) {
  if (seenSortOrders.has(row.sort_order)) {
    console.warn(`Skipping duplicate sort_order ${row.sort_order} ("${row.name}") for ${godId}.`);
    continue;
  }
  seenSortOrders.add(row.sort_order);
  rows.push(row);
}

const supabase = createClient(url, serviceKey);

const { error, count } = await supabase
  .from('god_abilities')
  .upsert(rows, { onConflict: 'god_id,sort_order', count: 'exact' });

if (error) {
  console.error('Seed failed:', error.message);
  process.exit(1);
}

console.log(`Seeded ${count ?? rows.length} abilities for ${godId}.`);
