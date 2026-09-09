'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AnimatedAuthCard } from '@/components/login/AnimatedAuthCard';
import { AuthInput } from '@/components/login/AuthInput';
import { NebulaBackground } from '@/components/three/NebulaBackground';
import { PasswordStrengthMeter } from '@/components/login/PasswordStrengthMeter';
import { LockIcon } from '@/components/icons';
import { describeAuthError, type AuthFailure } from '@/lib/auth-errors';
import { passwordSchema } from '@/lib/validation/password';

type Status = 'checking' | 'ready' | 'no-session' | 'saving' | 'done' | 'error';

/**
 * Where a password-recovery link lands (via /auth/confirm, which turns the
 * emailed token into a session first). Reachable only with that session, which
 * is what proves the person controls the mailbox.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('checking');
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  // Without a session there is nothing to change - that happens when someone
  // opens this URL directly, or when the emailed link has already expired.
  // Saying so beats a form that only fails on submit.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setStatus(data.user ? 'ready' : 'no-session');
      })
      .catch(() => {
        if (!cancelled) setStatus('no-session');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);

    // Validated here as well as by Supabase: Supabase's own minimum is a
    // project setting (6 by default), and this app's policy is stricter.
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setInvalid(parsed.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      setInvalid('Las dos contraseñas no coinciden.');
      return;
    }
    setInvalid(null);
    setStatus('saving');

    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setStatus('error');
        setFailure(describeAuthError(error, 'signup'));
        return;
      }
      setStatus('done');
      // Straight into the app - updateUser leaves the session signed in.
      setTimeout(() => {
        router.replace('/');
        router.refresh();
      }, 1200);
    } catch (thrown) {
      setStatus('error');
      setFailure(describeAuthError(thrown, 'signup'));
    }
  }

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ss-bg px-4 py-16"
    >
      <NebulaBackground />

      <div className="relative z-10 w-full max-w-sm">
        <h1 className="fade-up-in mb-2 font-display text-2xl font-bold text-ss-text">Nueva contraseña</h1>
        <p className="fade-up-in mb-6 text-sm text-ss-text-muted" style={{ animationDelay: '0.09s' }}>
          Elige una contraseña nueva para tu cuenta.
        </p>

        <div className="fade-up-in" style={{ animationDelay: '0.18s' }}>
          <AnimatedAuthCard>
            {status === 'checking' && (
              <p className="text-sm text-ss-text-muted" role="status">
                Comprobando el enlace...
              </p>
            )}

            {status === 'no-session' && (
              <div role="alert" className="flex flex-col gap-2 text-sm">
                <p className="font-semibold text-ss-loss">Este enlace ya no es válido.</p>
                <p className="text-ss-text-secondary">
                  Los enlaces de recuperación caducan al poco tiempo y solo se pueden usar una vez. Pide uno nuevo.
                </p>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="mt-1 self-start text-sm font-semibold text-ss-cyan hover:underline"
                >
                  Volver a iniciar sesión →
                </button>
              </div>
            )}

            {status === 'done' && (
              <p role="status" className="text-sm text-ss-win">
                ✓ Contraseña actualizada. Entrando...
              </p>
            )}

            {(status === 'ready' || status === 'saving' || status === 'error') && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
                <AuthInput
                  icon={<LockIcon size={16} />}
                  revealable
                  required
                  autoComplete="new-password"
                  aria-label="Contraseña nueva"
                  aria-describedby="password-requisitos"
                  aria-invalid={invalid ? true : undefined}
                  placeholder="contraseña nueva"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <PasswordStrengthMeter password={password} />

                <AuthInput
                  icon={<LockIcon size={16} />}
                  revealable
                  required
                  autoComplete="new-password"
                  aria-label="Repite la contraseña nueva"
                  aria-invalid={confirm && password !== confirm ? true : undefined}
                  placeholder="repite la contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />

                {invalid && (
                  <p role="alert" className="text-sm text-ss-loss">
                    {invalid}
                  </p>
                )}

                {status === 'error' && failure && (
                  <div
                    role="alert"
                    className="flex flex-col gap-1 rounded-md border border-ss-loss/40 bg-ss-loss/10 px-3 py-2 text-sm"
                  >
                    <p className="font-semibold text-ss-loss">{failure.message}</p>
                    {failure.hint && <p className="text-xs text-ss-text-secondary">{failure.hint}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'saving'}
                  className="neu-raised mt-1 flex h-10 items-center justify-center rounded-md bg-ss-cyan text-sm font-semibold text-ss-bg transition hover:brightness-110 disabled:opacity-60"
                >
                  {status === 'saving' ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </form>
            )}
          </AnimatedAuthCard>
        </div>
      </div>
    </main>
  );
}
