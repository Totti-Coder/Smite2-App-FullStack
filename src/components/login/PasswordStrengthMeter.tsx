'use client';

import { useId } from 'react';
import { passwordStrength, PASSWORD_MIN, PASSWORD_RECOMMENDED } from '@/lib/validation/password';

const BAR_COLOR = ['var(--ss-loss)', 'var(--ss-loss)', 'var(--ss-orange)', 'var(--ss-win)', 'var(--ss-win)'];

/**
 * Strength feedback for a new password.
 *
 * Advisory only - it never blocks submission, which is deliberate: a meter
 * that refuses a password the policy actually allows just teaches people to
 * append `1!` until the bar turns green, which is exactly the behaviour OWASP
 * warns composition rules produce.
 *
 * The requirements line is rendered whether or not anything has been typed, so
 * the rules are visible BEFORE someone invents a password and gets rejected,
 * and it is wired to the field with aria-describedby so a screen reader hears
 * it on focus rather than having to hunt for it.
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, advice } = passwordStrength(password);
  const liveId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{ background: password && i < score ? BAR_COLOR[score] : 'var(--ss-line)' }}
          />
        ))}
      </div>

      <p id="password-requisitos" className="text-[11px] text-ss-text-muted">
        Mínimo {PASSWORD_MIN} caracteres. A partir de {PASSWORD_RECOMMENDED} es bastante más segura; una frase larga
        funciona mejor que símbolos raros.
      </p>

      {/* The visual bar is decorative (aria-hidden), so the actual assessment
          is announced here instead - politely, so it doesn't interrupt typing. */}
      <p id={liveId} aria-live="polite" className="text-[11px] text-ss-text-secondary">
        {password ? `Seguridad: ${label}.${advice ? ' ' + advice : ''}` : ''}
      </p>
    </div>
  );
}
