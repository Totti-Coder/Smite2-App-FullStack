// The `next` parameter arrives inside an email link, so it is attacker-
// supplied text that people are primed to click. Anything that is not a
// same-site path must be discarded, or the recovery mail becomes an open
// redirect with our domain's credibility attached to it.
// Run: npx tsx scripts/check-safe-next.ts
import { safeNext } from '../src/app/auth/confirm/route';

const SAFE = '/cuenta/contrasena';

const hostile: [string, string][] = [
  ['protocol-relative', '//evil.com'],
  ['triple slash', '///evil.com'],
  ['https absoluta', 'https://evil.com'],
  ['http absoluta', 'http://evil.com'],
  ['backslash tras barra', '/\\evil.com'], // some parsers read \ as /
  ['doble backslash', '\\\\evil.com'],
  ['javascript:', 'javascript:alert(1)'],
  ['sin barra inicial', 'evil.com'],
  ['protocol-relative con ruta', '//evil.com/path'],
  ['data: URI', 'data:text/html,<script>alert(1)</script>'],
  ['vacio', ''],
];

// `/evil.com` is NOT hostile - it is an ordinary same-site path that would
// simply 404 on our own domain. Rejecting it would be wrong.
const legit = ['/partidas', '/gods/achilles', '/tierlist', '/cuenta/contrasena', '/evil.com'];

let pass = 0;
let fail = 0;

for (const [name, value] of hostile) {
  const got = safeNext(value);
  const ok = got === SAFE;
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), 'rechaza', name.padEnd(28), JSON.stringify(value).padEnd(42), '->', got);
}

for (const value of legit) {
  const got = safeNext(value);
  const ok = got === value;
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), 'permite', ''.padEnd(28), JSON.stringify(value).padEnd(42), '->', got);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
