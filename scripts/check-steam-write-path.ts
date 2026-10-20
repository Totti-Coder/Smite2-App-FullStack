// Guards migration 0012's invariants, which the type system cannot.
//
// Two failure modes motivate this file:
//
//  1. After 0012 the client role has no INSERT on steam_player_snapshots, but
//     database.types.ts still describes the table's Insert shape (service_role
//     and the seed scripts can write it). So
//     `.from('steam_player_snapshots').insert(...)` type-checks cleanly and
//     then fails at runtime - and it fails inside a best-effort path that
//     swallows errors, so it would fail SILENTLY, leaving the chart quietly
//     frozen. tsc cannot catch that; a source check can.
//
//  2. Postgres grants EXECUTE on a new function to PUBLIC by default. For a
//     SECURITY DEFINER function that default hands anon the function's owner
//     privileges - the entire vulnerability 0012 exists to close, reopened by
//     omission. Likewise an unpinned search_path lets the caller control name
//     resolution inside a function that runs as its owner. Both are easy to
//     forget on the NEXT such function, so the rule is checked against every
//     security-definer function in every migration, not just this one.
//
// Run: npx tsx scripts/check-steam-write-path.ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const MIGRATIONS = join(import.meta.dirname, '..', 'supabase', 'migrations');

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name.padEnd(58), detail);
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

/**
 * Drops comments before scanning. Without this the check cannot coexist with
 * its own documentation: the warning comment in database.types.ts spells out
 * the forbidden call verbatim, which tripped this rule on its first run. A
 * rule that punishes writing it down is a rule nobody can explain in place.
 *
 * Crude on purpose - a `//` inside a string literal (a URL) gets treated as a
 * comment and truncates the line. That can only ever cause a MISSED match in a
 * line that was already comment-like, never a false positive, which is the
 * direction that matters here.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// --- 1. no app-side INSERT into the table ---------------------------------
const TABLE = 'steam_player_snapshots';
const offenders: string[] = [];

for (const file of walk(SRC)) {
  const text = stripComments(readFileSync(file, 'utf8'));
  // Supabase query builders chain across newlines, so match from the table
  // reference up to the next .insert() without an intervening statement end.
  const re = new RegExp(String.raw`from\(\s*['"\`]${TABLE}['"\`]\s*\)[\s\S]{0,400}?\.insert\(`, 'g');
  if (re.test(text)) offenders.push(file.slice(SRC.length + 1));
}

check(`ningun .insert() sobre ${TABLE} en src/`, offenders.length === 0, offenders.join(', '));

// Comments stripped here too, so a leftover mention in prose can't stand in
// for the real call.
const steamLib = stripComments(readFileSync(join(SRC, 'lib', 'steam-player-count.ts'), 'utf8'));
check(
  'el muestreo usa la RPC record_steam_player_sample',
  steamLib.includes(`rpc('record_steam_player_sample'`)
);

// --- 2. every security-definer function is hardened ------------------------
const sqlFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));
check('hay migraciones que inspeccionar', sqlFiles.length > 0, `${sqlFiles.length} ficheros`);

// `create function public.name(args)` - the name is what the GRANT/REVOKE
// statements have to mention, so it is all this needs to extract.
const FN_RE = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(([^)]*)\)([\s\S]*?)(?=\n\s*create\s|\n\s*comment\s|\n\s*grant\s|\n\s*revoke\s|$)/gi;

let definerCount = 0;
for (const f of sqlFiles) {
  const sql = readFileSync(join(MIGRATIONS, f), 'utf8');

  for (const m of sql.matchAll(FN_RE)) {
    const [, name, , body] = m;
    if (!/security\s+definer/i.test(body)) continue;
    definerCount++;

    const short = `${f} ${name}`;
    check(`${short}: search_path fijado`, /set\s+search_path\s*=/i.test(body));

    // The revoke/grant pair lives after the function body, so look at the
    // whole file rather than the matched block.
    const revoked = new RegExp(
      String.raw`revoke\s+(?:all|execute)[\s\S]{0,80}?on\s+function\s+${name.replace('.', '\\.')}\s*\([^)]*\)\s+from\s+public`,
      'i'
    ).test(sql);
    check(`${short}: EXECUTE revocado a public`, revoked);
  }
}

// If the regex above ever stops matching (a migration reformats, or the
// pattern drifts), every rule inside the loop silently passes by never
// running. This asserts the scan actually found something.
check('se inspecciono al menos una funcion security definer', definerCount > 0, `${definerCount} encontradas`);

// --- 3. the table's own privileges ----------------------------------------
const m0012 = readFileSync(join(MIGRATIONS, '0012_steam_snapshots_write_path.sql'), 'utf8');
check(
  '0012 revoca INSERT al rol del cliente',
  /revoke\s+insert\s+on\s+public\.steam_player_snapshots\s+from\s+authenticated/i.test(m0012)
);
check(
  '0012 elimina la politica de insert abierta de 0009',
  /drop\s+policy\s+if\s+exists[\s\S]{0,120}on\s+public\.steam_player_snapshots/i.test(m0012)
);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
