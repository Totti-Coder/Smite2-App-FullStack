// Keeps hand-written catalog counts honest.
//
// "91 dioses · 265 items" appears in display copy and in docs, written out by
// hand both times, because deriving it would mean importing 160 KB of JSON
// into a client bundle (the login screen) or into a Markdown file (impossible).
// Hand-written numbers drift, and these did: the README claimed 88 gods / 252
// items and the login terminal claimed the same, long after the catalogs had
// grown to 91 and 265. The login screen is the first thing a visitor sees, so
// the stalest copy in the project was also the most visible.
//
// Rather than ban the literals, this checks them against the catalogs that are
// the actual source of truth. Add a new place that prints a count and it is
// covered automatically - the scan is by pattern, not by a list of files.
//
// Run: npx tsx scripts/check-catalog-copy.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import gods from '../src/data/gods.json';
import items from '../src/data/items.json';

const ROOT = join(import.meta.dirname, '..');

// The roles a match can be played in. Hardcoded here on purpose: Role lives in
// database.types.ts as a union type, which has no runtime value to count.
const ROLE_COUNT = 5;

const EXPECTED: Record<string, number> = {
  dioses: (gods as unknown[]).length,
  gods: (gods as unknown[]).length,
  items: (items as unknown[]).length,
  roles: ROLE_COUNT,
};

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name.padEnd(52), detail);
};

function filesToScan(): string[] {
  const out: string[] = [join(ROOT, 'README.md')];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

// "91 dioses", "265 items", "5 roles" - a number immediately followed by one
// of the catalog words.
//
// The trailing `(?![-\w])` is doing real work: \b alone does NOT stop at a
// hyphen, so every Tailwind class in the project matched - `gap-2
// items-center` reads as "2 items". That produced 27 false positives on the
// first run and would have made the check useless noise. The lookahead
// requires the word to actually END there, which `items-center` does not.
const WORDS = Object.keys(EXPECTED).join('|');
const COUNT_RE = new RegExp(String.raw`\b(\d+)\s+(${WORDS})(?![-\w])`, 'gi');

// Phrases where a number next to a catalog word is not a catalog total - a
// threshold, a cap, a page size. Checked against the whole matched line, so
// the exemption is visible to a reader of that line rather than hidden in a
// list of file paths.
const NOT_A_TOTAL =
  /máximo|maximo|hasta|al menos|por página|por pagina|slots?|MAX_|primeros?|últimos?|ultimos?/i;

/**
 * In source files, only strings a user can actually read are claims about the
 * catalog. Comments must stay free to quote historical values - gods/page.tsx
 * explains the old "0 dioses" bug by name, and a check that forbids writing
 * that down would be a check that erases its own postmortems.
 *
 * Markdown is deliberately NOT stripped: there every number is a claim to the
 * reader, including ones inside fenced code blocks (the README's install
 * snippet said "los 88 dioses de una vez" long after there were 91).
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, '');
}

let scanned = 0;
const problems: string[] = [];

for (const file of filesToScan()) {
  const raw = readFileSync(file, 'utf8');
  // Block comments are blanked rather than deleted, keeping newlines, so the
  // line numbers this reports still match the real file.
  const text = file.endsWith('.md') ? raw : stripComments(raw);
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    for (const m of line.matchAll(COUNT_RE)) {
      const [, rawCount, rawWord] = m;
      const word = rawWord.toLowerCase();
      if (NOT_A_TOTAL.test(line)) continue;

      scanned++;
      const actual = EXPECTED[word];
      if (Number(rawCount) !== actual) {
        problems.push(
          `${relative(ROOT, file)}:${i + 1}  dice "${rawCount} ${rawWord}", el catalogo tiene ${actual}`
        );
      }
    }
  });
}

check('todas las cifras de catalogo coinciden', problems.length === 0, problems.join('\n      '));

// If the pattern ever stops matching (copy reworded, files moved), every
// assertion above passes by never running. Assert the scan found something.
check('el escaneo encontro cifras que comprobar', scanned > 0, `${scanned} menciones`);

// Pin the catalog sizes themselves, so a half-finished edit to gods.json or
// items.json (a truncated file, a bad merge) is caught here rather than by a
// page rendering a suspiciously short list.
check('catalogo de dioses no vacio', (gods as unknown[]).length >= 90, `${(gods as unknown[]).length}`);
check('catalogo de items no vacio', (items as unknown[]).length >= 260, `${(items as unknown[]).length}`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
