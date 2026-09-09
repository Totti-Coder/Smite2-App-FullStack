'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { createClient } from '@/lib/supabase/client';
import { NebulaBackground } from '@/components/three/NebulaBackground';
import { ApiTerminal } from '@/components/login/ApiTerminal';
import { AnimatedAuthCard } from '@/components/login/AnimatedAuthCard';
import { AuthInput } from '@/components/login/AuthInput';
import { MotionToggle } from '@/components/motion/MotionToggle';
import { SparkleIcon, MailIcon, LockIcon } from '@/components/icons';
import { isMobileClient } from '@/lib/device';
import { describeAuthError, isTransportFailure, type AuthFailure } from '@/lib/auth-errors';
import { passwordSchema, passwordMatchesEmail } from '@/lib/validation/password';
import { PasswordStrengthMeter } from '@/components/login/PasswordStrengthMeter';

type Mode = 'login' | 'signup' | 'reset';
type Status = 'idle' | 'sending' | 'error' | 'signup-sent' | 'reset-sent';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStatus('idle');
    setFailure(null);
    setInvalid(null);
  }

  function fail(error: unknown) {
    setStatus('error');
    setFailure(describeAuthError(error, mode === 'login' ? 'login' : 'signup'));
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setInvalid(null);

    // Password policy is checked before anything leaves the browser, but only
    // for the paths that SET a password. Never on sign-in: an existing
    // password that predates the current rules must still be able to log in,
    // and telling someone at the login screen that their own password is
    // "too weak" would be both useless and a hint to an attacker.
    if (mode === 'signup') {
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) return setInvalid(parsed.error.issues[0].message);
      if (passwordMatchesEmail(password, email)) {
        return setInvalid('La contraseña no puede ser tu propio correo.');
      }
      if (password !== confirm) return setInvalid('Las dos contraseñas no coinciden.');
    }

    setStatus('sending');
    setFailure(null);

    // Everything is wrapped: supabase-js returns most problems in `error`, but
    // it can also THROW - createClient with bad env vars, or fetch rejecting
    // before the library gets to wrap it. Either path ended up showing the raw
    // exception text next to the password field.
    try {
      const supabase = createClient();

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return fail(error);
        router.replace('/');
        router.refresh();
        return;
      }

      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/confirm?next=/cuenta/contrasena`,
        });
        // Only a transport failure is reported. Whether the address has an
        // account is NOT revealed - the confirmation below is identical either
        // way, which is the same anti-enumeration rule the sign-in error
        // follows (see lib/auth-errors.ts).
        if (error && (isTransportFailure(error) || error.status === 429)) return fail(error);
        setStatus('reset-sent');
        return;
      }

      // Signup - every account gets its own fully isolated dashboard/partidas
      // (RLS already scopes every table by user_id, this doesn't change that
      // story at all, just who's allowed to open one). Whether a session
      // comes back immediately or not depends on this Supabase project's
      // "confirm email" setting - handle both without assuming which.
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return fail(error);
      if (data.session) {
        router.replace('/');
        router.refresh();
        return;
      }
      setStatus('signup-sent');
    } catch (thrown) {
      fail(thrown);
    }
  }

  // No Header on this page (it lives outside the (app) layout group), so
  // without this there was no way out of /login except submitting the
  // form. Real browser-back when there's somewhere to go back TO (e.g. you
  // came from /gods) - falls back to /gods otherwise (direct link, new tab),
  // since '/' itself would just bounce back here for a signed-out visitor.
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/gods');
  }

  // On a phone every route is gated (see lib/supabase/middleware.ts), so
  // "Volver" has nowhere to go - back or /gods both redirect straight here
  // again. Hiding it beats leaving a control that visibly does nothing.
  // Resolved after mount rather than during render: the check reads
  // `navigator`, which doesn't exist on the server, and branching the tree on
  // it directly would be a hydration mismatch.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: defers a navigator-dependent decision until after hydration so SSR and first client render match
    setIsDesktop(!isMobileClient());
  }, []);

  // /auth/confirm sends people back here with ?error=link_invalido when an
  // emailed token is expired or already spent. Read from the URL rather than
  // passed through state because the round trip goes via the mail client.
  const [linkError, setLinkError] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the URL, which is only available on the client
    setLinkError(new URLSearchParams(window.location.search).get('error') === 'link_invalido');
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ss-bg px-4 py-16">
      <NebulaBackground />

      {isDesktop && (
        <button
          type="button"
          onClick={goBack}
          className="group absolute top-6 left-6 z-10 flex items-center gap-1.5 text-sm text-ss-text-muted transition hover:text-ss-text"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span> Volver
        </button>
      )}

      {/* No Header on this page, so the motion opt-in lives here too -
          otherwise the one screen built around animation would be the one
          screen with no way to turn them on. */}
      <div className="absolute top-6 right-6 z-10">
        <MotionToggle />
      </div>

      <div className="relative z-10 grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Staggered entrance via .fade-up-in (globals.css) - each child is
            offset by animation-delay. See that rule for why this is CSS
            rather than a JS stagger. */}
        <div>
          <div className="fade-up-in mb-6 flex items-center gap-2">
            <SparkleIcon size={16} />
            <span className="text-xs font-semibold tracking-[0.2em] text-ss-purple uppercase">Tracker de Smite 2</span>
          </div>

          <h1 className="fade-up-in font-display text-4xl leading-[1.05] font-bold text-ss-text sm:text-5xl" style={{ animationDelay: '0.09s' }}>
            Smite 2 <span className="text-ss-cyan">Tracker</span>
          </h1>
          <p className="fade-up-in mt-3 max-w-sm text-sm text-ss-text-muted" style={{ animationDelay: '0.18s' }}>
            Winrate, builds, matchups - sacado de tus propias capturas, dios por dios.
          </p>

          <div className="fade-up-in" style={{ animationDelay: '0.27s' }}>
            <AnimatedAuthCard className="mt-8 max-w-sm">
              {linkError && status === 'idle' && (
                <div
                  role="alert"
                  className="mb-4 flex flex-col gap-1 rounded-md border border-ss-orange/40 bg-ss-orange/10 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-ss-orange">Ese enlace ya no sirve.</p>
                  <p className="text-xs text-ss-text-secondary">
                    Los enlaces caducan en una hora y solo valen para un uso. Pide otro desde &ldquo;¿Olvidaste tu
                    contraseña?&rdquo;.
                  </p>
                </div>
              )}

              {/* The tab pair stays two-wide: 'reset' is a detour off
                  sign-in, not a third peer, so it gets a link below the form
                  and keeps the 'Entrar' tab highlighted. */}
              <div className="mb-5 flex gap-1 rounded-md bg-ss-bg-raised p-1 text-sm">
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    aria-pressed={mode === m || (m === 'login' && mode === 'reset')}
                    className={`relative flex-1 rounded px-3 py-1.5 font-semibold transition-colors ${
                      mode === m ? 'text-ss-bg' : 'text-ss-text-muted hover:text-ss-text'
                    }`}
                  >
                    {/* Shared layout id makes the highlight slide between the
                        two tabs instead of just switching background. */}
                    {mode === m && (
                      <motion.span
                        layoutId="auth-tab"
                        className="absolute inset-0 rounded bg-ss-cyan"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative">{m === 'login' ? 'Entrar' : 'Crear cuenta'}</span>
                  </button>
                ))}
              </div>

              {/* Plain conditional rendering, NOT AnimatePresence mode="wait".
                  That wrapper holds the incoming child back until the outgoing
                  one finishes its exit animation - and under reduced motion
                  that animation never runs, so the swap never happened: the
                  "Crear cuenta" tab highlighted, `mode` changed, and the form
                  underneath stayed on sign-in forever. Anyone with reduced
                  motion on simply could not register. Third time this exact
                  trap has bitten in this codebase (login entrance, mobile
                  drawer, here), so the rule stands: never let an animation be
                  what decides whether content exists. */}
              {status === 'reset-sent' ? (
                <div key="reset-sent" role="status" className="fade-up-in flex flex-col gap-2 text-sm">
                    <p className="text-ss-win">✓ Enlace enviado.</p>
                    {/* Worded so it is TRUE whether or not the address has an
                        account - "si existe una cuenta". Confirming that the
                        email is registered would turn this form into an
                        account checker, which is the same leak the sign-in
                        error deliberately avoids. */}
                    <p className="text-ss-text-muted">
                      Si existe una cuenta con <strong className="text-ss-text">{email}</strong>, te llegará un enlace
                      para elegir una contraseña nueva. Caduca en una hora y solo se puede usar una vez.
                    </p>
                    <p className="text-xs text-ss-text-muted">Mira también la carpeta de spam.</p>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="mt-2 self-start text-ss-cyan hover:underline"
                    >
                      ← Volver a entrar
                    </button>
                </div>
              ) : status === 'signup-sent' ? (
                <div key="sent" role="status" className="fade-up-in flex flex-col gap-2 text-sm">
                    <p className="text-ss-win">✓ Cuenta creada.</p>
                    <p className="text-ss-text-muted">
                      Revisa <strong className="text-ss-text">{email}</strong> y confirma tu correo para poder entrar.
                    </p>
                    <button type="button" onClick={() => switchMode('login')} className="mt-2 self-start text-ss-cyan hover:underline">
                      ← Volver a entrar
                    </button>
                </div>
              ) : (
                <form key={mode} onSubmit={handleSubmit} noValidate className="fade-up-in flex flex-col gap-3">
                    {/* The visible design has no field labels, so the only
                        name these inputs had was the placeholder - which a
                        screen reader may skip and which vanishes the moment
                        you type. aria-label is the right tool HERE precisely
                        because there is no visible text to conflict with. */}
                    <AuthInput
                      icon={<MailIcon size={16} />}
                      type="email"
                      required
                      aria-label="Correo electrónico"
                      autoComplete="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {/* No password field at all when recovering - the whole
                        point is that the person doesn't have one. */}
                    {mode !== 'reset' && (
                      <AuthInput
                        icon={<LockIcon size={16} />}
                        revealable
                        required
                        aria-label="Contraseña"
                        aria-describedby={mode === 'signup' ? 'password-requisitos' : undefined}
                        aria-invalid={invalid ? true : undefined}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder="contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    )}

                    {mode === 'signup' && (
                      <>
                        <PasswordStrengthMeter password={password} />
                        <AuthInput
                          icon={<LockIcon size={16} />}
                          revealable
                          required
                          aria-label="Repite la contraseña"
                          aria-invalid={confirm && password !== confirm ? true : undefined}
                          autoComplete="new-password"
                          placeholder="repite la contraseña"
                          value={confirm}
                          onChange={(e) => setConfirm(e.target.value)}
                        />
                      </>
                    )}

                    {invalid && (
                      <p role="alert" className="text-sm text-ss-loss">
                        {invalid}
                      </p>
                    )}

                    <motion.button
                      type="submit"
                      disabled={status === 'sending'}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      className="neu-raised group relative mt-1 flex h-10 items-center justify-center overflow-hidden rounded-md bg-ss-cyan text-sm font-semibold text-ss-bg transition hover:brightness-110 disabled:opacity-60"
                    >
                      {/* Shimmer sweep, only while submitting */}
                      {status === 'sending' && (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
                        />
                      )}
                      {/* Same trap as the form swap above: wrapped in
                          AnimatePresence mode="wait" this label kept saying
                          "Entrar" after switching to sign-up, because the old
                          label's exit never completed. */}
                      {status === 'sending' ? (
                        <span
                          aria-hidden="true"
                          className="relative block h-4 w-4 animate-spin rounded-full border-2 border-ss-bg/70 border-t-transparent"
                        />
                      ) : (
                        <span className="relative flex items-center gap-1.5">
                          {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : 'Enviar enlace'}
                          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                        </span>
                      )}
                    </motion.button>

                    {/* Not animated in/out: the height animation is what makes
                        this readable, and an alert that fails to appear is
                        worse than one that appears plainly. Same rule as the
                        mobile nav drawer. */}
                    {status === 'error' && failure && (
                      // Announced immediately: a failed sign-in that only
                      // appears visually leaves a screen-reader user with no
                      // idea why nothing happened.
                      <div
                        role="alert"
                        className="flex flex-col gap-1 rounded-md border border-ss-loss/40 bg-ss-loss/10 px-3 py-2 text-sm"
                      >
                        <p className="font-semibold text-ss-loss">{failure.message}</p>
                        {failure.hint && <p className="text-xs text-ss-text-secondary">{failure.hint}</p>}

                        {failure.offerLogin && (
                          <button
                            type="button"
                            onClick={() => switchMode('login')}
                            className="mt-1 self-start text-xs font-semibold text-ss-cyan hover:underline"
                          >
                            Entrar con esa cuenta →
                          </button>
                        )}
                        {failure.retryable && !failure.offerLogin && (
                          <button
                            type="button"
                            onClick={() => handleSubmit()}
                            className="mt-1 self-start text-xs font-semibold text-ss-cyan hover:underline"
                          >
                            Reintentar
                          </button>
                        )}
                      </div>
                    )}

                    {/* The way out of a forgotten password, and the way back
                        from having asked. */}
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="self-start text-xs text-ss-text-muted transition hover:text-ss-cyan"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                    {mode === 'reset' && (
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="self-start text-xs text-ss-text-muted transition hover:text-ss-cyan"
                      >
                        ← Volver a entrar
                      </button>
                    )}
                </form>
              )}
            </AnimatedAuthCard>
          </div>

          {/* Only true on a computer now: on a phone those three routes are
              gated too, so offering them here would send the visitor straight
              back to this page. */}
          <p className="fade-up-in mt-4 max-w-sm text-xs text-ss-text-muted" style={{ animationDelay: '0.36s' }}>
            {isDesktop ? (
              <>
                Sin cuenta también puedes mirar <Link href="/gods" className="text-ss-cyan hover:underline">dioses</Link>,{' '}
                <Link href="/items" className="text-ss-cyan hover:underline">items</Link> y{' '}
                <Link href="/faq" className="text-ss-cyan hover:underline">FAQ</Link> - solo hace falta para tu dashboard y tus partidas.
              </>
            ) : (
              'Entra o crea una cuenta para ver tus partidas, tus builds y el resto de la web.'
            )}
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ApiTerminal />
        </div>
      </div>
    </main>
  );
}
