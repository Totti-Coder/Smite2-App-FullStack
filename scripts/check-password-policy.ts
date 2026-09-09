// Verifies the password policy and the strength meter.
// Run: npx tsx scripts/check-password-policy.ts
import { passwordSchema, passwordStrength, passwordMatchesEmail } from '../src/lib/validation/password';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), name.padEnd(48), detail);
};

const ok = (p: string) => passwordSchema.safeParse(p).success;

check('rechaza < 8 caracteres', !ok('Abc123'));
check('acepta 8 caracteres normales', ok('caballo7'));
check('rechaza "password"', !ok('password'));
check('rechaza "contrasena" (lista en castellano)', !ok('contrasena'));
check('rechaza "smite2026" (especifica de la app)', !ok('smite2026'));
check('rechaza solo espacios', !ok('         '));
check('acepta frase larga con espacios', ok('el caballo come hierba fresca'));
check('acepta acentos y ñ', ok('contraseñaSegura2026'));

// bcrypt trunca a 72 BYTES, no caracteres
const emoji73 = 'a'.repeat(69) + '🔒'; // 69 + 4 bytes = 73
check('rechaza > 72 bytes (aunque sean < 72 chars)', !ok(emoji73), `${[...emoji73].length} chars / ${Buffer.byteLength(emoji73)} bytes`);
check('acepta exactamente 72 bytes', ok('a'.repeat(72)));

check('rechaza la contrasena = tu correo', passwordMatchesEmail('pablo@gmail.com', 'pablo@gmail.com'));
check('rechaza la contrasena = parte local', passwordMatchesEmail('pablogroza', 'pablogroza@gmail.com'));
check('no confunde una distinta', !passwordMatchesEmail('otracosa123', 'pablo@gmail.com'));

// medidor
const s = (p: string) => passwordStrength(p).score;
check('frase larga puntua mas que P@ssw0rd', s('el caballo come hierba fresca') > s('P@ssw0rd'),
  `${s('el caballo come hierba fresca')} vs ${s('P@ssw0rd')}`);
check('penaliza secuencias', s('abcd1234efgh') < s('xkrtplmqweiu'), `${s('abcd1234efgh')} vs ${s('xkrtplmqweiu')}`);
check('comun = score 0', passwordStrength('password').score === 0);
check('vacia no rompe', passwordStrength('').label === '');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
