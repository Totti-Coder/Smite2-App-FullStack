// Guards the two steps that turn a screenshot into saved data: resolving the
// printed god name to a catalog id, and turning an OCR'd cell into numbers.
// Every case below is taken verbatim from a real "comparar stats" capture of
// a Spanish client, which is where the two bugs this file now pins down were
// found. Run: npx tsx scripts/check-ocr-parsing.ts
import { matchGodByName } from '../src/lib/god-name-match';
import { OCR_FIELDS, parseOcrText } from '../src/lib/ocr-fields';
import godsCatalog from '../src/data/gods.json';

const gods = godsCatalog as { id: string; name: string }[];
const field = (k: string) => OCR_FIELDS.find((x) => x.key === k)!;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name.padEnd(46), detail);
};

// --- god names, exactly as the Spanish client prints them -----------------
const NAMES: [string, string][] = [
  ['GUAN YU', 'guan_yu'],
  ['NUT', 'nut'],
  ['BASTET', 'bastet'],
  // Two letters. The short-name guard used to reject this before the exact
  // comparison ran, so a real god was silently unrecognisable.
  ['RA', 'ra'],
  ['HADES', 'hades'],
  ['NU WA', 'nu_wa'],
  // Printed short; the catalog calls her Princess Bari, too far for fuzzy.
  ['BARI', 'princess_bari'],
  ['GEB', 'geb'],
  ['CÚCHULAINN', 'cu_chulainn'],
  // Spanish spelling adds a leading I.
  ['IXBALANQUÉ', 'xbalanque'],
];

for (const [printed, expected] of NAMES) {
  const m = matchGodByName(printed, gods);
  check(`nombre "${printed}"`, m?.id === expected, m ? `${m.id} [${m.source}]` : 'sin coincidencia');
}

// Garbage must stay unrecognised: a confident wrong god is worse than none,
// because the review step makes "(sin detectar)" cheap to fix and a plausible
// wrong answer easy to wave through.
for (const junk of ['', '   ', '!!', '####']) {
  check(`basura ${JSON.stringify(junk)} se rechaza`, matchGodByName(junk, gods) === null);
}

// --- numeric cells --------------------------------------------------------
const CELLS: [string, string, number[]][] = [
  ['kda', '8/7/11', [8, 7, 11]],
  ['kda', '5/5/22', [5, 5, 22]],
  ['gold_per_min', '509', [509]],
  // Smite separates thousands with a space, so almost every damage cell looks
  // like two numbers unless the parser strips it.
  ['damage_to_players', '49 841', [49841]],
  ['damage_to_minions', '141 356', [141356]],
  ['damage_to_structures', '10 667', [10667]],
  ['ally_healing', '0', [0]],
  ['wards_placed', '14', [14]],
  // Best-in-category cells carry a star glyph inside the crop.
  ['gold_per_min', '★ 509', [509]],
];

for (const [key, raw, expected] of CELLS) {
  const got = parseOcrText(field(key), raw);
  check(`celda ${key} ${JSON.stringify(raw)}`, JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
