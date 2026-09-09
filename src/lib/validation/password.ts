import { z } from 'zod';

/**
 * Password rules, following OWASP ASVS 2.1 rather than folklore.
 *
 * What ASVS actually asks for is length and a check against known-breached or
 * obvious passwords. What it explicitly does NOT ask for - and what this
 * deliberately omits - are composition rules ("must contain an uppercase, a
 * number and a symbol"): they push people towards `Password1!`, which is
 * weaker than a long ordinary phrase, and towards writing passwords down.
 *
 * - Minimum 8 (ASVS 2.1.1). 12 is the recommendation, so the strength meter
 *   nudges towards it without blocking shorter ones.
 * - Maximum 72 BYTES, not characters: Supabase hashes with bcrypt, which
 *   silently truncates past 72 bytes. Anything longer would appear to be
 *   accepted while only the first 72 bytes ever mattered - and with accents
 *   or emoji a "character" can be 2-4 bytes, so this has to be measured in
 *   bytes to be true.
 * - No leading/trailing whitespace trimming: a space is a legitimate
 *   character in a passphrase, and trimming would silently change what the
 *   person typed. It is only rejected if the password is nothing BUT spaces.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_RECOMMENDED = 12;
export const PASSWORD_MAX_BYTES = 72;

/**
 * Local blocklist. A proper implementation would query HaveIBeenPwned's
 * k-anonymity range API, but this app's CSP is `connect-src 'self'
 * https://*.supabase.co`, so the browser cannot reach api.pwnedpasswords.com -
 * and loosening the CSP for it would be a bad trade. This catches the
 * passwords that actually show up at the top of every breach corpus, which is
 * where the real-world risk is concentrated.
 */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'welcome1', 'abc12345',
  'letmein1', 'football', 'baseball', 'sunshine', 'princess', 'dragon123',
  'monkey123', 'superman', 'trustno1', 'starwars', 'whatever', 'computer',
  // Spanish-language equivalents - a Spanish app gets Spanish weak passwords,
  // and English-only lists miss all of these.
  'contrasena', 'contraseña', 'contrasena1', 'micontrasena', 'administrador',
  'estrella', 'santiago', 'alejandro', 'cristina', 'sebastian', 'barcelona',
  'realmadrid', 'mariposa', 'chocolate', 'te-quiero', 'tequiero1',
  // This app specifically.
  'smite123', 'smite2024', 'smite2025', 'smite2026', 'smitetracker',
]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .refine((v) => byteLength(v) <= PASSWORD_MAX_BYTES, 'La contraseña es demasiado larga.')
  .refine((v) => v.trim().length > 0, 'La contraseña no puede ser solo espacios.')
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), 'Esa contraseña es demasiado común. Elige otra.');

/** Rejects a password that is just the email address or its local part. */
export function passwordMatchesEmail(password: string, email: string): boolean {
  const pw = password.toLowerCase();
  const addr = email.trim().toLowerCase();
  if (!addr) return false;
  const local = addr.split('@')[0];
  return pw === addr || (local.length >= 4 && pw === local);
}

export type PasswordStrength = {
  /** 0-4, for the meter. */
  score: number;
  label: string;
  /** The single most useful thing to do next, or null when it's already good. */
  advice: string | null;
};

/**
 * Feedback for the strength meter. Scores LENGTH and VARIETY, in that order of
 * weight, because length is what actually resists offline cracking - a
 * 16-character lowercase phrase beats an 8-character `P@ssw0rd` by orders of
 * magnitude. This never blocks submission; the schema above is the gate.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', advice: null };

  const length = [...password].length;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { score: 0, label: 'Muy débil', advice: 'Es una contraseña conocida, no la uses.' };
  }
  if (length < PASSWORD_MIN) {
    return { score: 0, label: 'Muy débil', advice: `Te faltan ${PASSWORD_MIN - length} caracteres.` };
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  const repeated = /(.)\1{3,}/.test(password);
  const sequential = /(abcd|bcde|cdef|1234|2345|3456|4567|5678|6789|qwer|asdf)/i.test(password);

  let score = 1;
  if (length >= PASSWORD_RECOMMENDED) score++;
  if (length >= 16) score++;
  if (classes >= 3) score++;
  if (repeated || sequential) score--;
  score = Math.max(0, Math.min(4, score));

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];

  let advice: string | null = null;
  if (repeated || sequential) advice = 'Evita secuencias o caracteres repetidos.';
  else if (length < PASSWORD_RECOMMENDED) advice = `Con ${PASSWORD_RECOMMENDED} caracteres o más sería bastante más segura.`;
  else if (score < 4) advice = 'Una frase larga y fácil de recordar es la opción más segura.';

  return { score, label: labels[score], advice };
}
