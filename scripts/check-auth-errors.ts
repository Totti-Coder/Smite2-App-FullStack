// Checks that every failure a person can actually hit on /login turns into a
// specific Spanish message instead of a raw library string.
// Run: npx tsx scripts/check-auth-errors.ts
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { describeAuthError } from '../src/lib/auth-errors';

type Case = {
  name: string;
  error: unknown;
  mode: 'login' | 'signup';
  expect: (r: ReturnType<typeof describeAuthError>) => boolean;
};

const cases: Case[] = [
  {
    name: 'DNS/red caida (el "Failed to fetch" del movil)',
    error: Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }),
    mode: 'login',
    expect: (r) => r.message.includes('No se pudo conectar') && !!r.retryable,
  },
  {
    name: 'Safari: "Load failed"',
    error: Object.assign(new TypeError('Load failed'), { name: 'TypeError' }),
    mode: 'login',
    expect: (r) => r.message.includes('No se pudo conectar'),
  },
  {
    name: 'Firefox: "NetworkError when attempting to fetch resource."',
    error: Object.assign(new TypeError('NetworkError when attempting to fetch resource.'), { name: 'TypeError' }),
    mode: 'login',
    expect: (r) => r.message.includes('No se pudo conectar'),
  },
  {
    name: 'AuthRetryableFetchError de supabase-js',
    error: new AuthRetryableFetchError('Failed to fetch', 0),
    mode: 'login',
    expect: (r) => r.message.includes('No se pudo conectar'),
  },
  {
    name: 'credenciales invalidas',
    error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    mode: 'login',
    expect: (r) => r.message.includes('correo o la contraseña'),
  },
  {
    name: 'correo sin confirmar',
    error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
    mode: 'login',
    expect: (r) => r.message.includes('confirmado') && !!r.hint?.includes('spam'),
  },
  {
    name: 'registro con correo ya existente -> ofrece entrar',
    error: new AuthApiError('User already registered', 422, 'email_exists'),
    mode: 'signup',
    expect: (r) => r.message.includes('Ya existe una cuenta') && r.offerLogin === true,
  },
  {
    name: 'rate limit',
    error: new AuthApiError('Too many requests', 429, 'over_request_rate_limit'),
    mode: 'login',
    expect: (r) => r.message.includes('Demasiados intentos') && !!r.retryable,
  },
  {
    name: 'contrasena debil',
    error: new AuthApiError('Password is too weak', 422, 'weak_password'),
    mode: 'signup',
    expect: (r) => r.message.includes('débil'),
  },
  {
    name: 'correo mal escrito',
    error: new AuthApiError('Invalid email', 400, 'email_address_invalid'),
    mode: 'signup',
    expect: (r) => r.message.includes('no es válido'),
  },
  {
    name: 'error 5xx del servidor',
    error: new AuthApiError('Internal error', 500, undefined),
    mode: 'login',
    expect: (r) => r.message.includes('servidor de autenticación'),
  },
  {
    name: 'error desconocido -> mensaje generico, nunca texto en ingles',
    error: new Error('some internal detail'),
    mode: 'login',
    expect: (r) => r.message === 'No se pudo iniciar sesión.' && !r.message.includes('internal'),
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const result = describeAuthError(c.error, c.mode);
  const ok = c.expect(result);
  if (ok) pass++;
  else fail++;
  console.log((ok ? 'PASS' : 'FAIL').padEnd(5), c.name.padEnd(52), '->', result.message);
}

// The enumeration guarantee, asserted rather than assumed: sign-in must never
// reveal whether the address has an account.
const signIn = describeAuthError(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'), 'login');
const leaks = /no existe|no está registrad|not found|sin cuenta|no encontrad/i.test(
  signIn.message + ' ' + (signIn.hint ?? '')
);
if (!leaks) pass++;
else fail++;
console.log((!leaks ? 'PASS' : 'FAIL').padEnd(5), 'login no revela si el correo existe');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
